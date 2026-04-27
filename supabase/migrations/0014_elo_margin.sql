-- Score cible configurable par session (3, 5, 7, 10...).
alter table public.play_sessions
  add column if not exists target_score int not null default 10;

-- ELO pondéré par la marge de buts.
-- La fonction v_delta binaire classique (elo_delta) reste inchangée pour l'undo
-- des anciens matches. On introduit elo_delta_weighted et record_match_v3 pour
-- tous les NOUVEAUX matches.
--
-- Formule : delta = round( k * margin_mult * dampener * (actual - expected) )
--   margin_mult = ln(margin + 1)             -> 1→ln2, 2→ln3, 3→ln4 …
--   dampener    = 2.2 / ((dElo_signed/400)+2.2)
--     où dElo_signed = elo_gagnant - elo_perdant.
--     Amplifie les upsets (outsider qui gagne) et tempère les stomps du favori.
-- Cf. formule "FIFA World Football Elo Ratings" (eloratings.net).

create or replace function public.elo_delta_weighted(
  ra int,
  rb int,
  actual_a numeric,
  score_a int,
  score_b int,
  k int default 32
) returns int language plpgsql immutable
set search_path = public
as $$
declare
  v_expected numeric := 1.0 / (1.0 + power(10, (rb - ra)::numeric / 400.0));
  v_margin   int     := abs(score_a - score_b);
  v_winner_r int;
  v_loser_r  int;
  v_d_elo    numeric;
  v_margin_mult numeric;
  v_dampener numeric;
begin
  if v_margin <= 0 then
    return 0;
  end if;
  if actual_a >= 0.5 then
    v_winner_r := ra;
    v_loser_r  := rb;
  else
    v_winner_r := rb;
    v_loser_r  := ra;
  end if;
  v_d_elo := (v_winner_r - v_loser_r)::numeric;
  v_margin_mult := ln(v_margin + 1);
  v_dampener := 2.2 / ((v_d_elo / 400.0) + 2.2);
  return round(k * v_margin_mult * v_dampener * (actual_a - v_expected))::int;
end; $$;

grant execute on function public.elo_delta_weighted(int, int, numeric, int, int, int) to anon, authenticated;

-- record_match_v3 : applique le delta pondéré.
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
      elo_delta_a, elo_delta_b, session_id)
    values ('individual', p_a1, p_b1, p_score_a, p_score_b, v_winner, v_delta_a, v_delta_b, p_session_id)
    returning id into v_match_id;
  else
    if p_a2 is null or p_b2 is null then raise exception 'Mode équipe : 2 joueurs requis par équipe'; end if;
    v_team_a := public.upsert_team(p_a1, p_a2);
    v_team_b := public.upsert_team(p_b1, p_b2);
    select round(avg(elo))::int into v_elo_a from public.players where id in (p_a1, p_a2);
    select round(avg(elo))::int into v_elo_b from public.players where id in (p_b1, p_b2);
    v_delta_a := public.elo_delta_weighted(v_elo_a, v_elo_b, v_actual_a, p_score_a, p_score_b);
    v_delta_b := -v_delta_a;
    update public.players set elo = elo + v_delta_a, games_played = games_played + 1 where id in (p_a1, p_a2);
    update public.players set elo = elo + v_delta_b, games_played = games_played + 1 where id in (p_b1, p_b2);
    select elo into v_team_elo_a from public.teams where id = v_team_a;
    select elo into v_team_elo_b from public.teams where id = v_team_b;
    v_team_delta_a := public.elo_delta_weighted(v_team_elo_a, v_team_elo_b, v_actual_a, p_score_a, p_score_b);
    v_team_delta_b := -v_team_delta_a;
    update public.teams set elo = elo + v_team_delta_a, games_played = games_played + 1 where id = v_team_a;
    update public.teams set elo = elo + v_team_delta_b, games_played = games_played + 1 where id = v_team_b;
    insert into public.matches (mode, team_a_id, team_b_id,
      player_a1_id, player_a2_id, player_b1_id, player_b2_id,
      score_a, score_b, winner_side, elo_delta_a, elo_delta_b,
      team_elo_delta_a, team_elo_delta_b, session_id)
    values ('team', v_team_a, v_team_b, p_a1, p_a2, p_b1, p_b2,
      p_score_a, p_score_b, v_winner, v_delta_a, v_delta_b,
      v_team_delta_a, v_team_delta_b, p_session_id)
    returning id into v_match_id;
  end if;
  return v_match_id;
end; $$;

grant execute on function public.record_match_v3(text, uuid, uuid, uuid, uuid, int, int, uuid) to anon, authenticated;

-- start_play_session_v2 : même chose que start_play_session mais avec target_score.
create or replace function public.start_play_session_v2(
  p_label text default null,
  p_target_score int default 10
) returns uuid language plpgsql security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_target_score is null or p_target_score < 1 or p_target_score > 30 then
    raise exception 'target_score invalide: %', p_target_score;
  end if;

  update public.play_sessions
    set status = 'ended', ended_at = now()
    where status = 'active';

  insert into public.play_sessions (label, target_score)
    values (p_label, p_target_score)
    returning id into v_id;

  return v_id;
end; $$;

grant execute on function public.start_play_session_v2(text, int) to anon, authenticated;
