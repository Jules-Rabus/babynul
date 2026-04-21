-- Verrouillage des écritures publiques : après migration vers Prisma,
-- l'application parle à Postgres via une connection authentifiée
-- (role `postgres` pooler), pas via PostgREST public. On drop donc les
-- policies d'écriture ouvertes qui traînent.
-- Les policies SELECT publiques restent pour permettre à Prisma via
-- le role `authenticated` de lire, et pour laisser un outil externe
-- lire la BDD en read-only si besoin futur.

-- players
drop policy if exists "players_insert_public" on public.players;
drop policy if exists "players_update_public" on public.players;
drop policy if exists "players_delete_public" on public.players;

-- teams
drop policy if exists "teams_insert_public" on public.teams;
drop policy if exists "teams_update_public" on public.teams;
drop policy if exists "teams_delete_public" on public.teams;

-- matches
drop policy if exists "matches_insert_public" on public.matches;
drop policy if exists "matches_update_public" on public.matches;
drop policy if exists "matches_delete_public" on public.matches;

-- proposed_matches
drop policy if exists "proposed_matches_insert_public" on public.proposed_matches;
drop policy if exists "proposed_matches_update_public" on public.proposed_matches;
drop policy if exists "proposed_matches_delete_public" on public.proposed_matches;

-- wagers
drop policy if exists "wagers_insert_public" on public.wagers;
drop policy if exists "wagers_update_public" on public.wagers;
drop policy if exists "wagers_delete_public" on public.wagers;

-- play_sessions
drop policy if exists "play_sessions_insert_public" on public.play_sessions;
drop policy if exists "play_sessions_update_public" on public.play_sessions;
drop policy if exists "play_sessions_delete_public" on public.play_sessions;

-- session_players
drop policy if exists "session_players_insert_public" on public.session_players;
drop policy if exists "session_players_update_public" on public.session_players;
drop policy if exists "session_players_delete_public" on public.session_players;

-- voice_prompt_config
drop policy if exists "voice_prompt_update_public" on public.voice_prompt_config;
drop policy if exists "voice_prompt_insert_public" on public.voice_prompt_config;
