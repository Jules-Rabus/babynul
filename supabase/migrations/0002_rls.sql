-- Row Level Security: lecture publique, écriture authentifiée

alter table public.players enable row level security;
alter table public.teams enable row level security;
alter table public.matches enable row level security;

-- Lecture publique (classements visibles sans connexion)
drop policy if exists "players_select_all" on public.players;
create policy "players_select_all" on public.players for select using (true);

drop policy if exists "teams_select_all" on public.teams;
create policy "teams_select_all" on public.teams for select using (true);

drop policy if exists "matches_select_all" on public.matches;
create policy "matches_select_all" on public.matches for select using (true);

-- Écriture réservée aux utilisateurs authentifiés
drop policy if exists "players_insert_auth" on public.players;
create policy "players_insert_auth" on public.players for insert
  to authenticated with check (true);

drop policy if exists "players_update_auth" on public.players;
create policy "players_update_auth" on public.players for update
  to authenticated using (true) with check (true);

drop policy if exists "players_delete_auth" on public.players;
create policy "players_delete_auth" on public.players for delete
  to authenticated using (true);

drop policy if exists "teams_insert_auth" on public.teams;
create policy "teams_insert_auth" on public.teams for insert
  to authenticated with check (true);

drop policy if exists "teams_update_auth" on public.teams;
create policy "teams_update_auth" on public.teams for update
  to authenticated using (true) with check (true);

drop policy if exists "teams_delete_auth" on public.teams;
create policy "teams_delete_auth" on public.teams for delete
  to authenticated using (true);

drop policy if exists "matches_insert_auth" on public.matches;
create policy "matches_insert_auth" on public.matches for insert
  to authenticated with check (true);

drop policy if exists "matches_delete_auth" on public.matches;
create policy "matches_delete_auth" on public.matches for delete
  to authenticated using (true);
