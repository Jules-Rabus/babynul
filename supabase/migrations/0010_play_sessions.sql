-- Play sessions : une "soirée" de matchmaking persistée en BDD.
-- Permet d'avoir une liste de joueurs présents vivante, de compter qui a joué
-- combien DANS la session (équité), et d'annuler les matchs non joués d'un coup
-- quand quelqu'un s'en va.

create table if not exists public.play_sessions (
  id uuid primary key default gen_random_uuid(),
  label text,
  status text not null default 'active' check (status in ('active','ended')),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

-- Au plus une session active à la fois.
create unique index if not exists play_sessions_one_active_idx
  on public.play_sessions (status)
  where status = 'active';

create index if not exists play_sessions_started_at_idx
  on public.play_sessions (started_at desc);

create table if not exists public.session_players (
  session_id uuid not null references public.play_sessions(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  is_present boolean not null default true,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (session_id, player_id)
);

create index if not exists session_players_player_idx
  on public.session_players (player_id);

-- Lier les proposed_matches et les matches joués à une session.
alter table public.proposed_matches
  add column if not exists session_id uuid references public.play_sessions(id) on delete set null;

create index if not exists proposed_matches_session_idx
  on public.proposed_matches (session_id, status);

alter table public.matches
  add column if not exists session_id uuid references public.play_sessions(id) on delete set null;

create index if not exists matches_session_idx
  on public.matches (session_id, played_at desc);

-- RLS : lecture publique, écritures via RPC (ou direct, on reste cohérent avec le reste)
alter table public.play_sessions enable row level security;
alter table public.session_players enable row level security;

create policy "play_sessions_select_all" on public.play_sessions for select using (true);
create policy "play_sessions_insert_public" on public.play_sessions for insert to anon, authenticated with check (true);
create policy "play_sessions_update_public" on public.play_sessions for update to anon, authenticated using (true) with check (true);
create policy "play_sessions_delete_public" on public.play_sessions for delete to anon, authenticated using (true);

create policy "session_players_select_all" on public.session_players for select using (true);
create policy "session_players_insert_public" on public.session_players for insert to anon, authenticated with check (true);
create policy "session_players_update_public" on public.session_players for update to anon, authenticated using (true) with check (true);
create policy "session_players_delete_public" on public.session_players for delete to anon, authenticated using (true);

-- RPC : démarrer une session (termine toute session active existante).
create or replace function public.start_play_session(p_label text default null)
returns uuid language plpgsql security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  update public.play_sessions
    set status = 'ended', ended_at = now()
    where status = 'active';

  insert into public.play_sessions (label) values (p_label)
    returning id into v_id;

  return v_id;
end; $$;

-- RPC : clôturer une session.
create or replace function public.end_play_session(p_session_id uuid)
returns void language plpgsql security definer
set search_path = public
as $$
begin
  update public.play_sessions
    set status = 'ended', ended_at = now()
    where id = p_session_id and status = 'active';
end; $$;

-- RPC : marquer la présence d'un joueur dans la session (upsert).
create or replace function public.set_session_presence(
  p_session_id uuid, p_player_id uuid, p_present boolean
) returns void language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.session_players (session_id, player_id, is_present, joined_at, left_at)
  values (p_session_id, p_player_id, p_present, now(), case when p_present then null else now() end)
  on conflict (session_id, player_id) do update
    set is_present = excluded.is_present,
        left_at = case when excluded.is_present then null else now() end,
        joined_at = case when excluded.is_present and public.session_players.left_at is not null
                         then now() else public.session_players.joined_at end;
end; $$;

-- RPC : annuler tous les proposed_matches 'open' d'une session (ex. joueur qui part,
-- ou admin qui régénère). Rembourse les wagers au passage.
create or replace function public.cancel_open_matches_for_session(
  p_session_id uuid,
  p_involving_player uuid default null
) returns int language plpgsql security definer
set search_path = public
as $$
declare
  v_match_id uuid;
  v_count int := 0;
begin
  for v_match_id in
    select id from public.proposed_matches
     where session_id = p_session_id
       and status = 'open'
       and (
         p_involving_player is null
         or team_a_p1 = p_involving_player
         or team_a_p2 = p_involving_player
         or team_b_p1 = p_involving_player
         or team_b_p2 = p_involving_player
       )
  loop
    perform public.cancel_proposed_match(v_match_id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end; $$;

-- RPC : record_match_v2 = record_match + p_session_id.
-- On garde record_match tel quel pour rétrocompat, et on fait passer session_id ici.
create or replace function public.record_match_v2(
  p_mode text, p_a1 uuid, p_a2 uuid, p_b1 uuid, p_b2 uuid,
  p_score_a int, p_score_b int, p_session_id uuid default null
) returns uuid language plpgsql security definer
set search_path = public
as $$
declare
  v_match_id uuid;
begin
  v_match_id := public.record_match(p_mode, p_a1, p_a2, p_b1, p_b2, p_score_a, p_score_b);
  if p_session_id is not null then
    update public.matches set session_id = p_session_id where id = v_match_id;
  end if;
  return v_match_id;
end; $$;

grant execute on function public.start_play_session(text) to anon, authenticated;
grant execute on function public.end_play_session(uuid) to anon, authenticated;
grant execute on function public.set_session_presence(uuid, uuid, boolean) to anon, authenticated;
grant execute on function public.cancel_open_matches_for_session(uuid, uuid) to anon, authenticated;
grant execute on function public.record_match_v2(text, uuid, uuid, uuid, uuid, int, int, uuid) to anon, authenticated;
