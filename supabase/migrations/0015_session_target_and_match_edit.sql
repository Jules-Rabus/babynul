-- Permettre à l'admin de :
--   1) modifier le score cible d'une session de matchmaking en cours,
--   2) corriger le score d'un match déjà enregistré, avec recalcul de l'Elo.
-- Le recalcul reverse les deltas du match, puis ré-applique des deltas frais
-- calculés à partir de l'Elo courant des joueurs/équipes.

create or replace function public.set_play_session_target_score(
  p_session_id uuid,
  p_target_score int
) returns void language plpgsql security definer
set search_path = public
as $$
begin
  if p_target_score is null or p_target_score < 1 or p_target_score > 30 then
    raise exception 'target_score invalide: %', p_target_score;
  end if;

  update public.play_sessions
    set target_score = p_target_score
    where id = p_session_id and status = 'active';

  if not found then
    raise exception 'Session active introuvable: %', p_session_id;
  end if;
end; $$;

grant execute on function public.set_play_session_target_score(uuid, int) to anon, authenticated;

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
begin
  if p_score_a = p_score_b then raise exception 'Match nul non supporté'; end if;
  if p_score_a < 0 or p_score_b < 0 then raise exception 'Score invalide'; end if;

  select * into v_m from public.matches where id = p_match_id;
  if v_m.id is null then raise exception 'Match introuvable: %', p_match_id; end if;

  -- 1) Reverse des anciens deltas pour revenir à l'Elo "sans ce match".
  if v_m.mode = 'individual' then
    update public.players set elo = elo - v_m.elo_delta_a where id = v_m.player_a1_id;
    update public.players set elo = elo - v_m.elo_delta_b where id = v_m.player_b1_id;
  else
    update public.players set elo = elo - v_m.elo_delta_a
      where id in (v_m.player_a1_id, v_m.player_a2_id);
    update public.players set elo = elo - v_m.elo_delta_b
      where id in (v_m.player_b1_id, v_m.player_b2_id);
    if v_m.team_elo_delta_a is not null then
      update public.teams set elo = elo - v_m.team_elo_delta_a where id = v_m.team_a_id;
      update public.teams set elo = elo - v_m.team_elo_delta_b where id = v_m.team_b_id;
    end if;
  end if;

  -- 2) Recalcul des deltas avec l'Elo courant et les nouveaux scores.
  v_winner   := case when p_score_a > p_score_b then 'A' else 'B' end;
  v_actual_a := case when v_winner = 'A' then 1 else 0 end;

  if v_m.mode = 'individual' then
    select elo into v_elo_a from public.players where id = v_m.player_a1_id;
    select elo into v_elo_b from public.players where id = v_m.player_b1_id;
    v_delta_a := public.elo_delta_weighted(v_elo_a, v_elo_b, v_actual_a, p_score_a, p_score_b);
    v_delta_b := -v_delta_a;
    update public.players set elo = elo + v_delta_a where id = v_m.player_a1_id;
    update public.players set elo = elo + v_delta_b where id = v_m.player_b1_id;
  else
    select round(avg(elo))::int into v_elo_a from public.players
      where id in (v_m.player_a1_id, v_m.player_a2_id);
    select round(avg(elo))::int into v_elo_b from public.players
      where id in (v_m.player_b1_id, v_m.player_b2_id);
    v_delta_a := public.elo_delta_weighted(v_elo_a, v_elo_b, v_actual_a, p_score_a, p_score_b);
    v_delta_b := -v_delta_a;
    update public.players set elo = elo + v_delta_a
      where id in (v_m.player_a1_id, v_m.player_a2_id);
    update public.players set elo = elo + v_delta_b
      where id in (v_m.player_b1_id, v_m.player_b2_id);

    select elo into v_team_elo_a from public.teams where id = v_m.team_a_id;
    select elo into v_team_elo_b from public.teams where id = v_m.team_b_id;
    v_team_delta_a := public.elo_delta_weighted(v_team_elo_a, v_team_elo_b, v_actual_a, p_score_a, p_score_b);
    v_team_delta_b := -v_team_delta_a;
    update public.teams set elo = elo + v_team_delta_a where id = v_m.team_a_id;
    update public.teams set elo = elo + v_team_delta_b where id = v_m.team_b_id;
  end if;

  update public.matches set
    score_a = p_score_a,
    score_b = p_score_b,
    winner_side = v_winner,
    elo_delta_a = v_delta_a,
    elo_delta_b = v_delta_b,
    team_elo_delta_a = v_team_delta_a,
    team_elo_delta_b = v_team_delta_b
  where id = p_match_id;

  -- Si le vainqueur a basculé, refléter sur le proposed_match lié (le cas
  -- échéant). Les wagers déjà settled ne sont pas recalculés.
  update public.proposed_matches
    set winner_side = v_winner
    where match_id = p_match_id;

  return p_match_id;
end; $$;

grant execute on function public.edit_match_score(uuid, int, int) to anon, authenticated;
