-- RLS : lecture publique + écriture ouverte (anon + authenticated).
-- Mode app interne : le gate se fait côté UI via cookie httpOnly posé par une Server Action.
-- Contexte collègues de confiance — la vraie sécurité, c'est le code admin serveur.

alter table public.players enable row level security;
alter table public.teams enable row level security;
alter table public.matches enable row level security;

-- SELECT public
drop policy if exists "players_select_all" on public.players;
create policy "players_select_all" on public.players for select using (true);
drop policy if exists "teams_select_all" on public.teams;
create policy "teams_select_all" on public.teams for select using (true);
drop policy if exists "matches_select_all" on public.matches;
create policy "matches_select_all" on public.matches for select using (true);

-- INSERT/UPDATE/DELETE ouverts à anon + authenticated
drop policy if exists "players_insert_public" on public.players;
create policy "players_insert_public" on public.players for insert to anon, authenticated with check (true);
drop policy if exists "players_update_public" on public.players;
create policy "players_update_public" on public.players for update to anon, authenticated using (true) with check (true);
drop policy if exists "players_delete_public" on public.players;
create policy "players_delete_public" on public.players for delete to anon, authenticated using (true);

drop policy if exists "teams_insert_public" on public.teams;
create policy "teams_insert_public" on public.teams for insert to anon, authenticated with check (true);
drop policy if exists "teams_update_public" on public.teams;
create policy "teams_update_public" on public.teams for update to anon, authenticated using (true) with check (true);
drop policy if exists "teams_delete_public" on public.teams;
create policy "teams_delete_public" on public.teams for delete to anon, authenticated using (true);

drop policy if exists "matches_insert_public" on public.matches;
create policy "matches_insert_public" on public.matches for insert to anon, authenticated with check (true);
drop policy if exists "matches_update_public" on public.matches;
create policy "matches_update_public" on public.matches for update to anon, authenticated using (true) with check (true);
drop policy if exists "matches_delete_public" on public.matches;
create policy "matches_delete_public" on public.matches for delete to anon, authenticated using (true);
