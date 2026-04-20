-- RPC transactionnels : record_match, delete_player_cascade
-- Formule Elo: expected = 1 / (1 + 10^((rb - ra)/400)), delta = round(K * (actual - expected)), K = 32

create or replace function public.elo_delta(ra int, rb int, actual_a numeric, k int default 32)
returns int
language sql
immutable
as $$
  select round(k * (actual_a - 1.0 / (1.0 + power(10, (rb - ra)::numeric / 400.0))))::int;
$$;

-- Ordonne une paire (p1, p2) canoniquement (p1 < p2)
create or replace function public.canonicalize_pair(a uuid, b uuid, out p1 uuid, out p2 uuid)
language plpgsql
immutable
as $$
begin
  if a < b then p1 := a; p2 := b; else p1 := b; p2 := a; end if;
end;
$$;

-- Recherche ou crée une équipe pour une paire de joueurs
create or replace function public.upsert_team(a uuid, b uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p1 uuid;
  v_p2 uuid;
  v_team_id uuid;
  v_elo int;
begin
  select p1, p2 into v_p1, v_p2 from public.canonicalize_pair(a, b);

  select id into v_team_id from public.teams where player1_id = v_p1 and player2_id = v_p2;
  if v_team_id is not null then
    return v_team_id;
  end if;

  -- Nouvelle équipe : Elo initial = moyenne des joueurs
  select round(avg(elo))::int into v_elo from public.players where id in (v_p1, v_p2);
  v_elo := coalesce(v_elo, 1000);

  insert into public.teams (player1_id, player2_id, elo, games_played)
  values (v_p1, v_p2, v_elo, 0)
  returning id into v_team_id;

  return v_team_id;
end;
$$;

-- Enregistre un match et applique les deltas Elo en transaction
-- Input:
--   mode: 'individual' | 'team'
--   score_a, score_b: int
--   individual: { a1, a2, b1, b2 } uuid
--   team:      { a1, a2, b1, b2 } uuid  (joueurs d'équipe A et B)
create or replace function public.record_match(
  p_mode text,
  p_a1 uuid,
  p_a2 uuid,
  p_b1 uuid,
  p_b2 uuid,
  p_score_a int,
  p_score_b int
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match_id uuid;
  v_winner text;
  v_actual_a numeric;
  v_team_a uuid;
  v_team_b uuid;
  v_elo_a int;
  v_elo_b int;
  v_team_elo_a int;
  v_team_elo_b int;
  v_delta_a int;
  v_delta_b int;
  v_team_delta_a int := null;
  v_team_delta_b int := null;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise';
  end if;

  if p_mode not in ('individual','team') then
    raise exception 'Mode invalide: %', p_mode;
  end if;

  if p_score_a = p_score_b then
    raise exception 'Match nul non supporté';
  end if;

  v_winner := case when p_score_a > p_score_b then 'A' else 'B' end;
  v_actual_a := case when v_winner = 'A' then 1 else 0 end;

  if p_mode = 'individual' then
    -- Individuel : 1v1, p_a2 et p_b2 doivent être null
    select elo into v_elo_a from public.players where id = p_a1;
    select elo into v_elo_b from public.players where id = p_b1;
    if v_elo_a is null or v_elo_b is null then
      raise exception 'Joueur introuvable';
    end if;

    v_delta_a := public.elo_delta(v_elo_a, v_elo_b, v_actual_a);
    v_delta_b := -v_delta_a;

    update public.players set elo = elo + v_delta_a, games_played = games_played + 1 where id = p_a1;
    update public.players set elo = elo + v_delta_b, games_played = games_played + 1 where id = p_b1;

    insert into public.matches (
      mode, player_a1_id, player_b1_id, score_a, score_b, winner_side,
      elo_delta_a, elo_delta_b, recorded_by
    ) values (
      'individual', p_a1, p_b1, p_score_a, p_score_b, v_winner,
      v_delta_a, v_delta_b, auth.uid()
    ) returning id into v_match_id;

  else
    -- Équipe 2v2
    if p_a2 is null or p_b2 is null then
      raise exception 'Mode équipe : 2 joueurs requis par équipe';
    end if;

    v_team_a := public.upsert_team(p_a1, p_a2);
    v_team_b := public.upsert_team(p_b1, p_b2);

    -- Elo individuel = moyenne des 2 joueurs de l'équipe
    select round(avg(elo))::int into v_elo_a from public.players where id in (p_a1, p_a2);
    select round(avg(elo))::int into v_elo_b from public.players where id in (p_b1, p_b2);

    v_delta_a := public.elo_delta(v_elo_a, v_elo_b, v_actual_a);
    v_delta_b := -v_delta_a;

    update public.players set elo = elo + v_delta_a, games_played = games_played + 1 where id in (p_a1, p_a2);
    update public.players set elo = elo + v_delta_b, games_played = games_played + 1 where id in (p_b1, p_b2);

    -- Elo d'équipe
    select elo into v_team_elo_a from public.teams where id = v_team_a;
    select elo into v_team_elo_b from public.teams where id = v_team_b;

    v_team_delta_a := public.elo_delta(v_team_elo_a, v_team_elo_b, v_actual_a);
    v_team_delta_b := -v_team_delta_a;

    update public.teams set elo = elo + v_team_delta_a, games_played = games_played + 1 where id = v_team_a;
    update public.teams set elo = elo + v_team_delta_b, games_played = games_played + 1 where id = v_team_b;

    insert into public.matches (
      mode, team_a_id, team_b_id,
      player_a1_id, player_a2_id, player_b1_id, player_b2_id,
      score_a, score_b, winner_side,
      elo_delta_a, elo_delta_b,
      team_elo_delta_a, team_elo_delta_b,
      recorded_by
    ) values (
      'team', v_team_a, v_team_b,
      p_a1, p_a2, p_b1, p_b2,
      p_score_a, p_score_b, v_winner,
      v_delta_a, v_delta_b,
      v_team_delta_a, v_team_delta_b,
      auth.uid()
    ) returning id into v_match_id;
  end if;

  return v_match_id;
end;
$$;

-- Suppression complète d'un joueur + équipes + matches associés
create or replace function public.delete_player_cascade(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentification requise';
  end if;

  -- Matches où ce joueur intervient (individuel OU équipe)
  delete from public.matches
  where player_a1_id = p_player_id
     or player_a2_id = p_player_id
     or player_b1_id = p_player_id
     or player_b2_id = p_player_id;

  -- Équipes contenant ce joueur (cascade supprimera leurs matches restants)
  delete from public.teams
  where player1_id = p_player_id or player2_id = p_player_id;

  delete from public.players where id = p_player_id;
end;
$$;

grant execute on function public.record_match(text, uuid, uuid, uuid, uuid, int, int) to authenticated;
grant execute on function public.delete_player_cascade(uuid) to authenticated;
