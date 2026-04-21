-- Surnom optionnel par joueur.
-- Affiché "Prénom (Surnom)" dans l'UI, utilisé seul pour les annonces vocales.

alter table public.players
  add column if not exists nickname text;

create index if not exists players_nickname_search_idx
  on public.players (lower(nickname))
  where nickname is not null;
