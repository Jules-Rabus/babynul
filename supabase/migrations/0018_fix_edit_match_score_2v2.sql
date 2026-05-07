-- Fix bug : edit_match_score en mode team ne tenait pas compte de la
-- redistribution intra-équipe (carry, migration 0016). Le reverse appliquait
-- la moyenne d'équipe aux deux coéquipiers, et le recalcul ne passait pas par
-- distribute_team_delta — corrompant l'Elo des porteurs/partenaires.
--
-- Pour reverse de manière exacte, on stocke désormais les deltas individuels
-- par joueur sur la ligne matches. record_match_v3 et edit_match_score les
-- peuplent. Les anciennes lignes (deltas individuels = NULL) tombent en
-- fallback sur la moyenne d'équipe (comportement précédent, acceptable car
-- il s'agit de matchs qui n'ont jamais bénéficié du carry).

alter table public.matches
  add column if not exists elo_delta_a1 int,
  add column if not exists elo_delta_a2 int,
  add column if not exists elo_delta_b1 int,
  add column if not exists elo_delta_b2 int;


-- 1) record_match_v3 : on stocke maintenant aussi les deltas individuels.
create or replace function public.record_match_v3(
  p_mode text, p_a1 uuid, p_a2 uuid, p_b1 uuid, p_b2 uuid,
  p_score_a int, p_score_b int, p_session_id uuid default null
) returns uuid language plpgsql security definer
set search_path = public
as $$
declare
  v_match_id uuid; v_winner text; v_actual_a numeric;
  v_team_a uuid; v_team_b uuid;
  v_elo_a int; v_elo_b int; v_team_elo_a int; v_team_elo_b int;
  v_delta_a int; v_delta_b int;
  v_team_delta_a int := null; v_team_delta_b int := null;
  v_elo_a1 int; v_elo_a2 int; v_elo_b1 int; v_elo_b2 int;
  v_delta_a1 int; v_delta_a2 int;
  v_delta_b1 int; v_delta_b2 int;
begin
  if p_mode not in ('individual','team') then raise exception 'Mode invalide: %', p_mode; end if;
  if p_score_a = p_score_b then raise exception 'Match nul non supporté'; end if;
  v_winner   := case when p_score_a > p_score_b then 'A' else 'B' end;
  v_actual_a := case when v_winner = 'A' then 1 else 0 end;

  if p_mode = 'individual' then
    select elo into v_elo_a from public.players where id = p_a1;
    select elo into v_elo_b from public.players where id = p_b1;
    if v_elo_a is null or v_elo_b is null then raise exception 'Joueur introuvable'; end if;
    v_delta_a := public.elo_delta_weighted(v_elo_a, v_elo_b, v_actual_a, p_score_a, p_score_b);
    v_delta_b := -v_delta_a;
    update public.players set elo = elo + v_delta_a, games_played = games_played + 1 where id = p_a1;
    update public.players set elo = elo + v_delta_b, games_played = games_played + 1 where id = p_b1;
    insert into public.matches (mode, player_a1_id, player_b1_id, score_a, score_b, winner_side,
      elo_delta_a, elo_delta_b, elo_delta_a1, elo_delta_b1, session_id)
    values ('individual', p_a1, p_b1, p_score_a, p_score_b, v_winner,
      v_delta_a, v_delta_b, v_delta_a, v_delta_b, p_session_id)
    returning id into v_match_id;
  else
    if p_a2 is null or p_b2 is null then raise exception 'Mode équipe : 2 joueurs requis par équipe'; end if;
    v_team_a := public.upsert_team(p_a1, p_a2);
    v_team_b := public.upsert_team(p_b1, p_b2);

    select elo into v_elo_a1 from public.players where id = p_a1;
    select elo into v_elo_a2 from public.players where id = p_a2;
    select elo into v_elo_b1 from public.players where id = p_b1;
    select elo into v_elo_b2 from public.players where id = p_b2;
    if v_elo_a1 is null or v_elo_a2 is null or v_elo_b1 is null or v_elo_b2 is null then
      raise exception 'Joueur introuvable';
    end if;

    v_elo_a := round(((v_elo_a1 + v_elo_a2)::numeric) / 2)::int;
    v_elo_b := round(((v_elo_b1 + v_elo_b2)::numeric) / 2)::int;
    v_delta_a := public.elo_delta_weighted(v_elo_a, v_elo_b, v_actual_a, p_score_a, p_score_b);
    v_delta_b := -v_delta_a;

    select delta1, delta2 into v_delta_a1, v_delta_a2
      from public.distribute_team_delta(v_delta_a, v_elo_a1, v_elo_a2);
    select delta1, delta2 into v_delta_b1, v_delta_b2
      from public.distribute_team_delta(v_delta_b, v_elo_b1, v_elo_b2);

    update public.players set elo = elo + v_delta_a1, games_played = games_played + 1 where id = p_a1;
    update public.players set elo = elo + v_delta_a2, games_played = games_played + 1 where id = p_a2;
    update public.players set elo = elo + v_delta_b1, games_played = games_played + 1 where id = p_b1;
    update public.players set elo = elo + v_delta_b2, games_played = games_played + 1 where id = p_b2;

    select elo into v_team_elo_a from public.teams where id = v_team_a;
    select elo into v_team_elo_b from public.teams where id = v_team_b;
    v_team_delta_a := public.elo_delta_weighted(v_team_elo_a, v_team_elo_b, v_actual_a, p_score_a, p_score_b);
    v_team_delta_b := -v_team_delta_a;
    update public.teams set elo = elo + v_team_delta_a, games_played = games_played + 1 where id = v_team_a;
    update public.teams set elo = elo + v_team_delta_b, games_played = games_played + 1 where id = v_team_b;

    insert into public.matches (mode, team_a_id, team_b_id,
      player_a1_id, player_a2_id, player_b1_id, player_b2_id,
      score_a, score_b, winner_side, elo_delta_a, elo_delta_b,
      elo_delta_a1, elo_delta_a2, elo_delta_b1, elo_delta_b2,
      team_elo_delta_a, team_elo_delta_b, session_id)
    values ('team', v_team_a, v_team_b, p_a1, p_a2, p_b1, p_b2,
      p_score_a, p_score_b, v_winner, v_delta_a, v_delta_b,
      v_delta_a1, v_delta_a2, v_delta_b1, v_delta_b2,
      v_team_delta_a, v_team_delta_b, p_session_id)
    returning id into v_match_id;
  end if;
  return v_match_id;
end; $$;

grant execute on function public.record_match_v3(text, uuid, uuid, uuid, uuid, int, int, uuid) to anon, authenticated;


-- 2) edit_match_score : reverse correctement les deltas individuels (avec
--    fallback sur la moyenne pour les anciennes lignes), puis recalcule via
--    distribute_team_delta.
create or replace function public.edit_match_score(
  p_match_id uuid,
  p_score_a int,
  p_score_b int
) returns uuid language plpgsql security definer
set search_path = public
as $$
declare
  v_m public.matches;
  v_winner text;
  v_actual_a numeric;
  v_elo_a int; v_elo_b int;
  v_team_elo_a int; v_team_elo_b int;
  v_delta_a int; v_delta_b int;
  v_team_delta_a int := null; v_team_delta_b int := null;
  v_elo_a1 int; v_elo_a2 int; v_elo_b1 int; v_elo_b2 int;
  v_delta_a1 int; v_delta_a2 int;
  v_delta_b1 int; v_delta_b2 int;
  v_rev_a1 int; v_rev_a2 int; v_rev_b1 int; v_rev_b2 int;
begin
  if p_score_a = p_score_b then raise exception 'Match nul non supporté'; end if;
  if p_score_a < 0 or p_score_b < 0 then raise exception 'Score invalide'; end if;

  select * into v_m from public.matches where id = p_match_id for update;
  if v_m.id is null then raise exception 'Match introuvable: %', p_match_id; end if;

  -- 1) Reverse des anciens deltas (joueurs).
  if v_m.mode = 'individual' then
    update public.players set elo = elo - v_m.elo_delta_a where id = v_m.player_a1_id;
    update public.players set elo = elo - v_m.elo_delta_b where id = v_m.player_b1_id;
  else
    -- Fallback sur la moyenne d'équipe si les deltas individuels manquent
    -- (anciennes lignes pré-0018, qui n'avaient pas non plus de carry — la
    -- moyenne y était la valeur effectivement appliquée).
    v_rev_a1 := coalesce(v_m.elo_delta_a1, v_m.elo_delta_a);
    v_rev_a2 := coalesce(v_m.elo_delta_a2, v_m.elo_delta_a);
    v_rev_b1 := coalesce(v_m.elo_delta_b1, v_m.elo_delta_b);
    v_rev_b2 := coalesce(v_m.elo_delta_b2, v_m.elo_delta_b);

    update public.players set elo = elo - v_rev_a1 where id = v_m.player_a1_id;
    update public.players set elo = elo - v_rev_a2 where id = v_m.player_a2_id;
    update public.players set elo = elo - v_rev_b1 where id = v_m.player_b1_id;
    update public.players set elo = elo - v_rev_b2 where id = v_m.player_b2_id;

    if v_m.team_elo_delta_a is not null and v_m.team_a_id is not null then
      update public.teams set elo = elo - v_m.team_elo_delta_a where id = v_m.team_a_id;
    end if;
    if v_m.team_elo_delta_b is not null and v_m.team_b_id is not null then
      update public.teams set elo = elo - v_m.team_elo_delta_b where id = v_m.team_b_id;
    end if;
  end if;

  -- 2) Recalcul.
  v_winner   := case when p_score_a > p_score_b then 'A' else 'B' end;
  v_actual_a := case when v_winner = 'A' then 1 else 0 end;

  if v_m.mode = 'individual' then
    select elo into v_elo_a from public.players where id = v_m.player_a1_id;
    select elo into v_elo_b from public.players where id = v_m.player_b1_id;
    v_delta_a := public.elo_delta_weighted(v_elo_a, v_elo_b, v_actual_a, p_score_a, p_score_b);
    v_delta_b := -v_delta_a;
    update public.players set elo = elo + v_delta_a where id = v_m.player_a1_id;
    update public.players set elo = elo + v_delta_b where id = v_m.player_b1_id;

    update public.matches set
      score_a = p_score_a,
      score_b = p_score_b,
      winner_side = v_winner,
      elo_delta_a = v_delta_a,
      elo_delta_b = v_delta_b,
      elo_delta_a1 = v_delta_a,
      elo_delta_b1 = v_delta_b,
      team_elo_delta_a = null,
      team_elo_delta_b = null
    where id = p_match_id;
  else
    select elo into v_elo_a1 from public.players where id = v_m.player_a1_id;
    select elo into v_elo_a2 from public.players where id = v_m.player_a2_id;
    select elo into v_elo_b1 from public.players where id = v_m.player_b1_id;
    select elo into v_elo_b2 from public.players where id = v_m.player_b2_id;

    v_elo_a := round(((v_elo_a1 + v_elo_a2)::numeric) / 2)::int;
    v_elo_b := round(((v_elo_b1 + v_elo_b2)::numeric) / 2)::int;
    v_delta_a := public.elo_delta_weighted(v_elo_a, v_elo_b, v_actual_a, p_score_a, p_score_b);
    v_delta_b := -v_delta_a;

    select delta1, delta2 into v_delta_a1, v_delta_a2
      from public.distribute_team_delta(v_delta_a, v_elo_a1, v_elo_a2);
    select delta1, delta2 into v_delta_b1, v_delta_b2
      from public.distribute_team_delta(v_delta_b, v_elo_b1, v_elo_b2);

    update public.players set elo = elo + v_delta_a1 where id = v_m.player_a1_id;
    update public.players set elo = elo + v_delta_a2 where id = v_m.player_a2_id;
    update public.players set elo = elo + v_delta_b1 where id = v_m.player_b1_id;
    update public.players set elo = elo + v_delta_b2 where id = v_m.player_b2_id;

    select elo into v_team_elo_a from public.teams where id = v_m.team_a_id;
    select elo into v_team_elo_b from public.teams where id = v_m.team_b_id;
    v_team_delta_a := public.elo_delta_weighted(v_team_elo_a, v_team_elo_b, v_actual_a, p_score_a, p_score_b);
    v_team_delta_b := -v_team_delta_a;
    update public.teams set elo = elo + v_team_delta_a where id = v_m.team_a_id;
    update public.teams set elo = elo + v_team_delta_b where id = v_m.team_b_id;

    update public.matches set
      score_a = p_score_a,
      score_b = p_score_b,
      winner_side = v_winner,
      elo_delta_a = v_delta_a,
      elo_delta_b = v_delta_b,
      elo_delta_a1 = v_delta_a1,
      elo_delta_a2 = v_delta_a2,
      elo_delta_b1 = v_delta_b1,
      elo_delta_b2 = v_delta_b2,
      team_elo_delta_a = v_team_delta_a,
      team_elo_delta_b = v_team_delta_b
    where id = p_match_id;
  end if;

  -- Refléter le bascule de vainqueur sur le proposed_match si lié.
  update public.proposed_matches
    set winner_side = v_winner
    where match_id = p_match_id;

  return p_match_id;
end; $$;

grant execute on function public.edit_match_score(uuid, int, int) to anon, authenticated;


-- 3) delete_match_full : utilise aussi les deltas individuels en 2v2 (avec
--    fallback sur la moyenne pour les anciennes lignes).
create or replace function public.delete_match_full(p_match_id uuid)
returns uuid language plpgsql security definer
set search_path = public
as $$
declare
  v_m public.matches;
  v_proposed_ids uuid[];
  v_rev_a1 int; v_rev_a2 int; v_rev_b1 int; v_rev_b2 int;
begin
  select * into v_m from public.matches where id = p_match_id for update;
  if v_m.id is null then raise exception 'Match introuvable: %', p_match_id; end if;

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
    v_rev_a1 := coalesce(v_m.elo_delta_a1, v_m.elo_delta_a);
    v_rev_a2 := coalesce(v_m.elo_delta_a2, v_m.elo_delta_a);
    v_rev_b1 := coalesce(v_m.elo_delta_b1, v_m.elo_delta_b);
    v_rev_b2 := coalesce(v_m.elo_delta_b2, v_m.elo_delta_b);

    update public.players
       set elo = elo - v_rev_a1,
           games_played = greatest(0, games_played - 1)
     where id = v_m.player_a1_id;
    update public.players
       set elo = elo - v_rev_a2,
           games_played = greatest(0, games_played - 1)
     where id = v_m.player_a2_id;
    update public.players
       set elo = elo - v_rev_b1,
           games_played = greatest(0, games_played - 1)
     where id = v_m.player_b1_id;
    update public.players
       set elo = elo - v_rev_b2,
           games_played = greatest(0, games_played - 1)
     where id = v_m.player_b2_id;

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

  select array_agg(id) into v_proposed_ids
    from public.proposed_matches
   where match_id = p_match_id;

  delete from public.matches where id = p_match_id;

  if v_proposed_ids is not null then
    for i in 1 .. array_length(v_proposed_ids, 1) loop
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

      update public.wagers
         set status = 'refunded',
             payout = stake
       where proposed_match_id = v_proposed_ids[i]
         and status in ('won','lost','pending');

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


-- 4) undo_last_match : même fix (utilise les deltas individuels en 2v2).
create or replace function public.undo_last_match()
returns uuid language plpgsql security definer
set search_path = public
as $$
declare
  v_m public.matches;
  v_proposed_ids uuid[];
  v_rev_a1 int; v_rev_a2 int; v_rev_b1 int; v_rev_b2 int;
begin
  delete from public.matches
  where id = (
    select id from public.matches
    order by played_at desc
    limit 1
    for update skip locked
  )
  returning * into v_m;

  if v_m.id is null then raise exception 'Aucun match à annuler'; end if;

  if v_m.mode = 'individual' then
    update public.players set elo = elo - v_m.elo_delta_a, games_played = greatest(0, games_played - 1)
      where id = v_m.player_a1_id;
    update public.players set elo = elo - v_m.elo_delta_b, games_played = greatest(0, games_played - 1)
      where id = v_m.player_b1_id;
  else
    v_rev_a1 := coalesce(v_m.elo_delta_a1, v_m.elo_delta_a);
    v_rev_a2 := coalesce(v_m.elo_delta_a2, v_m.elo_delta_a);
    v_rev_b1 := coalesce(v_m.elo_delta_b1, v_m.elo_delta_b);
    v_rev_b2 := coalesce(v_m.elo_delta_b2, v_m.elo_delta_b);

    update public.players set elo = elo - v_rev_a1, games_played = greatest(0, games_played - 1)
      where id = v_m.player_a1_id;
    update public.players set elo = elo - v_rev_a2, games_played = greatest(0, games_played - 1)
      where id = v_m.player_a2_id;
    update public.players set elo = elo - v_rev_b1, games_played = greatest(0, games_played - 1)
      where id = v_m.player_b1_id;
    update public.players set elo = elo - v_rev_b2, games_played = greatest(0, games_played - 1)
      where id = v_m.player_b2_id;

    if v_m.team_elo_delta_a is not null then
      update public.teams set elo = elo - v_m.team_elo_delta_a, games_played = greatest(0, games_played - 1)
        where id = v_m.team_a_id;
      update public.teams set elo = elo - v_m.team_elo_delta_b, games_played = greatest(0, games_played - 1)
        where id = v_m.team_b_id;
    end if;
  end if;

  select array_agg(id) into v_proposed_ids
    from public.proposed_matches where match_id = v_m.id;

  if v_proposed_ids is not null then
    for i in 1 .. array_length(v_proposed_ids, 1) loop
      update public.wagers
        set status = 'refunded', payout = stake
        where proposed_match_id = v_proposed_ids[i] and status in ('won','lost');

      update public.players p
        set wager_balance = p.wager_balance + w.stake - coalesce(w.payout, 0),
            wager_total_won = greatest(0, p.wager_total_won - greatest(0, coalesce(w.payout, 0) - w.stake)),
            wager_total_lost = case when w.side <> (select winner_side from public.proposed_matches where id = v_proposed_ids[i])
                                    then greatest(0, p.wager_total_lost - w.stake)
                                    else p.wager_total_lost end,
            wager_bets_won = case when w.side = (select winner_side from public.proposed_matches where id = v_proposed_ids[i])
                                  then greatest(0, p.wager_bets_won - 1)
                                  else p.wager_bets_won end
        from public.wagers w
        where w.proposed_match_id = v_proposed_ids[i] and w.player_id = p.id and w.status = 'refunded';

      update public.proposed_matches
        set status = 'cancelled', match_id = null, winner_side = null, resolved_at = null
        where id = v_proposed_ids[i];
    end loop;
  end if;

  return v_m.id;
end; $$;

grant execute on function public.undo_last_match() to anon, authenticated;
