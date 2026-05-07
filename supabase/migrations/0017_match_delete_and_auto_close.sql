-- 1) delete_match_full : annulation totale d'un match joué.
--    - Reverse les deltas Elo (joueurs + équipe en 2v2),
--    - Décrémente games_played,
--    - Rembourse / annule les wagers liés au proposed_match (si rattaché),
--    - Supprime la ligne match,
--    - Repasse le proposed_match en 'cancelled' (match_id = null).
--
--    Important : on suit la même convention que undo_last_match — les deltas
--    stockés sur la ligne (elo_delta_a/b) sont la moyenne d'équipe (cf. 0016
--    record_match_v3). On reverse ces moyennes côté joueurs, et les deltas
--    d'équipe team_elo_delta_a/b côté teams.

create or replace function public.delete_match_full(p_match_id uuid)
returns uuid language plpgsql security definer
set search_path = public
as $$
declare
  v_m public.matches;
  v_proposed_ids uuid[];
begin
  select * into v_m from public.matches where id = p_match_id for update;
  if v_m.id is null then raise exception 'Match introuvable: %', p_match_id; end if;

  -- 1) Reverse deltas Elo + games_played
  if v_m.mode = 'individual' then
    update public.players
       set elo = elo - v_m.elo_delta_a,
           games_played = greatest(0, games_played - 1)
     where id = v_m.player_a1_id;
    update public.players
       set elo = elo - v_m.elo_delta_b,
           games_played = greatest(0, games_played - 1)
     where id = v_m.player_b1_id;
  else
    update public.players
       set elo = elo - v_m.elo_delta_a,
           games_played = greatest(0, games_played - 1)
     where id in (v_m.player_a1_id, v_m.player_a2_id);
    update public.players
       set elo = elo - v_m.elo_delta_b,
           games_played = greatest(0, games_played - 1)
     where id in (v_m.player_b1_id, v_m.player_b2_id);
    if v_m.team_elo_delta_a is not null and v_m.team_a_id is not null then
      update public.teams
         set elo = elo - v_m.team_elo_delta_a,
             games_played = greatest(0, games_played - 1)
       where id = v_m.team_a_id;
    end if;
    if v_m.team_elo_delta_b is not null and v_m.team_b_id is not null then
      update public.teams
         set elo = elo - v_m.team_elo_delta_b,
             games_played = greatest(0, games_played - 1)
       where id = v_m.team_b_id;
    end if;
  end if;

  -- 2) Récupère les proposed_matches liés AVANT de supprimer le match.
  select array_agg(id) into v_proposed_ids
    from public.proposed_matches
   where match_id = p_match_id;

  -- 3) Supprime la ligne match.
  delete from public.matches where id = p_match_id;

  -- 4) Rembourse les wagers et repasse les proposed_matches en 'cancelled'.
  if v_proposed_ids is not null then
    for i in 1 .. array_length(v_proposed_ids, 1) loop
      -- Réajuste les soldes parieurs en partant des wagers settled (won/lost).
      update public.players p
         set wager_balance      = p.wager_balance + w.stake - coalesce(w.payout, 0),
             wager_total_won    = greatest(0, p.wager_total_won
                                           - greatest(0, coalesce(w.payout, 0) - w.stake)),
             wager_total_lost   = case
                                    when w.side <> (select winner_side
                                                      from public.proposed_matches
                                                     where id = v_proposed_ids[i])
                                    then greatest(0, p.wager_total_lost - w.stake)
                                    else p.wager_total_lost
                                  end,
             wager_bets_won     = case
                                    when w.side = (select winner_side
                                                     from public.proposed_matches
                                                    where id = v_proposed_ids[i])
                                    then greatest(0, p.wager_bets_won - 1)
                                    else p.wager_bets_won
                                  end
        from public.wagers w
       where w.proposed_match_id = v_proposed_ids[i]
         and w.player_id = p.id
         and w.status in ('won','lost');

      -- Marque les wagers comme remboursés.
      update public.wagers
         set status = 'refunded',
             payout = stake
       where proposed_match_id = v_proposed_ids[i]
         and status in ('won','lost','pending');

      -- Repasse le proposed_match en 'cancelled' (détaché du match supprimé).
      update public.proposed_matches
         set status = 'cancelled',
             match_id = null,
             winner_side = null,
             resolved_at = null
       where id = v_proposed_ids[i];
    end loop;
  end if;

  return p_match_id;
end; $$;

grant execute on function public.delete_match_full(uuid) to anon, authenticated;


-- 2) record_manual_match : créer un match "from scratch" (sans proposed_match).
--    Wrapper autour de record_match_v3 qui prend juste les joueurs et le score.
--    On délègue tout le calcul Elo à record_match_v3 (déjà conforme à /algo).
create or replace function public.record_manual_match(
  p_mode text,
  p_a1 uuid,
  p_a2 uuid,
  p_b1 uuid,
  p_b2 uuid,
  p_score_a int,
  p_score_b int,
  p_session_id uuid default null
) returns uuid language plpgsql security definer
set search_path = public
as $$
declare
  v_match_id uuid;
begin
  -- record_match_v3 valide déjà mode/score/joueurs.
  v_match_id := public.record_match_v3(
    p_mode, p_a1, p_a2, p_b1, p_b2, p_score_a, p_score_b, p_session_id
  );
  return v_match_id;
end; $$;

grant execute on function public.record_manual_match(text, uuid, uuid, uuid, uuid, int, int, uuid) to anon, authenticated;


-- 3) auto_close_stale_sessions : clôture les sessions actives dont le jour calendaire
--    (Europe/Paris) est antérieur à aujourd'hui. Appelée paresseusement par la route
--    /api/sessions/active à chaque chargement. Idempotente.
create or replace function public.auto_close_stale_sessions()
returns int language plpgsql security definer
set search_path = public
as $$
declare
  v_count int;
begin
  with closed as (
    update public.play_sessions
       set status = 'ended',
           ended_at = coalesce(ended_at, now())
     where status = 'active'
       and (started_at at time zone 'Europe/Paris')::date
           < (now()        at time zone 'Europe/Paris')::date
    returning id
  )
  select count(*)::int into v_count from closed;
  return coalesce(v_count, 0);
end; $$;

grant execute on function public.auto_close_stale_sessions() to anon, authenticated;
