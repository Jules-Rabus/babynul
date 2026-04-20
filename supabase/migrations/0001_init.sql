-- Babynul! — Initial schema
-- Tables: players, teams, matches

create extension if not exists "pgcrypto";

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  first_name text not null,
  last_name text not null,
  elo integer not null default 1000,
  games_played integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists players_auth_user_id_idx on public.players (auth_user_id);
create index if not exists players_elo_idx on public.players (elo desc);
create index if not exists players_search_idx on public.players (lower(first_name || ' ' || last_name));

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  player1_id uuid not null references public.players(id) on delete cascade,
  player2_id uuid not null references public.players(id) on delete cascade,
  elo integer not null default 1000,
  games_played integer not null default 0,
  created_at timestamptz not null default now(),
  constraint teams_player_order check (player1_id < player2_id),
  constraint teams_pair_unique unique (player1_id, player2_id)
);

create index if not exists teams_elo_idx on public.teams (elo desc);
create index if not exists teams_p1_idx on public.teams (player1_id);
create index if not exists teams_p2_idx on public.teams (player2_id);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('individual','team')),
  team_a_id uuid references public.teams(id) on delete cascade,
  team_b_id uuid references public.teams(id) on delete cascade,
  player_a1_id uuid references public.players(id) on delete cascade,
  player_a2_id uuid references public.players(id) on delete cascade,
  player_b1_id uuid references public.players(id) on delete cascade,
  player_b2_id uuid references public.players(id) on delete cascade,
  score_a integer not null,
  score_b integer not null,
  winner_side text not null check (winner_side in ('A','B')),
  elo_delta_a integer not null default 0,
  elo_delta_b integer not null default 0,
  team_elo_delta_a integer,
  team_elo_delta_b integer,
  played_at timestamptz not null default now(),
  recorded_by uuid references auth.users(id) on delete set null
);

create index if not exists matches_played_at_idx on public.matches (played_at desc);
create index if not exists matches_team_a_idx on public.matches (team_a_id);
create index if not exists matches_team_b_idx on public.matches (team_b_id);
create index if not exists matches_player_a1_idx on public.matches (player_a1_id);
create index if not exists matches_player_a2_idx on public.matches (player_a2_id);
create index if not exists matches_player_b1_idx on public.matches (player_b1_id);
create index if not exists matches_player_b2_idx on public.matches (player_b2_id);
