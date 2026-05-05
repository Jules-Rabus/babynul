-- Deux raffinements de l'algo Elo (miroir SQL de src/lib/elo.ts) :
--
-- 1) closeness factor : un match à 1 point d'écart (3-2, 10-9...) compte 0.7×.
--    Évite qu'un match presque équilibré coûte autant qu'une vraie démo.
--
-- 2) distribution intra-équipe en 2v2 : le delta d'équipe est redistribué
--    entre les deux coéquipiers selon leur écart à la moyenne.
--    Le porteur (Elo > moyenne) perd moins / gagne plus ; son partenaire
--    en dessous fait le miroir. Conservation : delta1 + delta2 = 2 × delta_team.

-- 1) Patch elo_delta_weighted : ajout du closeness factor.
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
  v_closeness numeric;
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
  v_closeness := case when v_margin = 1 then 0.7 else 1.0 end;
  return round(k * v_margin_mult * v_dampener * v_closeness * (actual_a - v_expected))::int;
end; $$;

grant execute on function public.elo_delta_weighted(int, int, numeric, int, int, int) to anon, authenticated;

-- 2) distribute_team_delta : redistribue un delta équipe entre les deux coéquipiers.
--    Renvoie un record (delta1, delta2) où delta1 correspond au joueur d'Elo elo_p1.
create or replace function public.distribute_team_delta(
  delta_team int,
  elo_p1 int,
  elo_p2 int,
  alpha numeric default 0.4,
  spread_cap numeric default 1.0
) returns table(delta1 int, delta2 int)
language plpgsql immutable
set search_path = public
as $$
declare
  v_avg numeric;
  v_spread1 numeric;
  v_spread2 numeric;
  v_is_loss boolean;
  v_f1 numeric;
  v_f2 numeric;
  v_target int;
  v_raw numeric;
  v_norm numeric;
  v_d1 int;
  v_d2 int;
begin
  if delta_team = 0 then
    delta1 := 0; delta2 := 0; return next; return;
  end if;
  v_avg := (elo_p1 + elo_p2)::numeric / 2.0;
  v_spread1 := greatest(-spread_cap, least(spread_cap, (elo_p1 - v_avg) / 400.0));
  v_spread2 := -v_spread1;
  v_is_loss := delta_team < 0;
  if v_is_loss then
    v_f1 := 1 - alpha * v_spread1;
    v_f2 := 1 - alpha * v_spread2;
  else
    v_f1 := 1 + alpha * v_spread1;
    v_f2 := 1 + alpha * v_spread2;
  end if;
  v_target := 2 * delta_team;
  v_raw := delta_team * v_f1 + delta_team * v_f2;
  if v_raw = 0 then
    v_norm := 1;
  else
    v_norm := v_target / v_raw;
  end if;
  v_d1 := round(delta_team * v_f1 * v_norm)::int;
  v_d2 := v_target - v_d1;
  delta1 := v_d1; delta2 := v_d2;
  return next;
end; $$;

grant execute on function public.distribute_team_delta(int, int, int, numeric, numeric) to anon, authenticated;

-- 3) record_match_v3 : applique la redistribution intra-équipe en mode team.
--    Mode individual inchangé.
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
      elo_delta_a, elo_delta_b, session_id)
    values ('individual', p_a1, p_b1, p_score_a, p_score_b, v_winner, v_delta_a, v_delta_b, p_session_id)
    returning id into v_match_id;
  else
    if p_a2 is null or p_b2 is null then raise exception 'Mode équipe : 2 joueurs requis par équipe'; end if;
    v_team_a := public.upsert_team(p_a1, p_a2);
    v_team_b := public.upsert_team(p_b1, p_b2);

    -- Elos individuels avant match (pour la redistribution).
    select elo into v_elo_a1 from public.players where id = p_a1;
    select elo into v_elo_a2 from public.players where id = p_a2;
    select elo into v_elo_b1 from public.players where id = p_b1;
    select elo into v_elo_b2 from public.players where id = p_b2;
    if v_elo_a1 is null or v_elo_a2 is null or v_elo_b1 is null or v_elo_b2 is null then
      raise exception 'Joueur introuvable';
    end if;

    -- Moyennes d'équipe pour le delta global côté joueur.
    v_elo_a := round(((v_elo_a1 + v_elo_a2)::numeric) / 2)::int;
    v_elo_b := round(((v_elo_b1 + v_elo_b2)::numeric) / 2)::int;
    v_delta_a := public.elo_delta_weighted(v_elo_a, v_elo_b, v_actual_a, p_score_a, p_score_b);
    v_delta_b := -v_delta_a;

    -- Redistribution intra-équipe : porteur perd moins / gagne plus.
    select delta1, delta2 into v_delta_a1, v_delta_a2
      from public.distribute_team_delta(v_delta_a, v_elo_a1, v_elo_a2);
    select delta1, delta2 into v_delta_b1, v_delta_b2
      from public.distribute_team_delta(v_delta_b, v_elo_b1, v_elo_b2);

    update public.players set elo = elo + v_delta_a1, games_played = games_played + 1 where id = p_a1;
    update public.players set elo = elo + v_delta_a2, games_played = games_played + 1 where id = p_a2;
    update public.players set elo = elo + v_delta_b1, games_played = games_played + 1 where id = p_b1;
    update public.players set elo = elo + v_delta_b2, games_played = games_played + 1 where id = p_b2;

    -- Delta équipe (Elo équipe ≠ moyenne joueurs) : inchangé, calculé sur l'Elo équipe stocké.
    select elo into v_team_elo_a from public.teams where id = v_team_a;
    select elo into v_team_elo_b from public.teams where id = v_team_b;
    v_team_delta_a := public.elo_delta_weighted(v_team_elo_a, v_team_elo_b, v_actual_a, p_score_a, p_score_b);
    v_team_delta_b := -v_team_delta_a;
    update public.teams set elo = elo + v_team_delta_a, games_played = games_played + 1 where id = v_team_a;
    update public.teams set elo = elo + v_team_delta_b, games_played = games_played + 1 where id = v_team_b;

    -- Pour préserver le contrat existant (elo_delta_a / elo_delta_b sur la ligne match),
    -- on stocke la moyenne d'équipe (delta_a1 + delta_a2)/2 qui vaut v_delta_a par construction.
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
