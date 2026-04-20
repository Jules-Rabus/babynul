-- Pari de la semaine : 1 question posée par l'admin, N options, votes anonymes par cookie/device.

create table if not exists public.bets (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  options text[] not null check (array_length(options, 1) between 2 and 6),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists bets_active_idx on public.bets (active, created_at desc);

create table if not exists public.bet_votes (
  id uuid primary key default gen_random_uuid(),
  bet_id uuid not null references public.bets(id) on delete cascade,
  voter_key text not null,  -- cookie client uniquement, pas une identité réelle
  option_index int not null check (option_index >= 0),
  created_at timestamptz not null default now(),
  unique (bet_id, voter_key)
);

create index if not exists bet_votes_bet_idx on public.bet_votes (bet_id);

alter table public.bets enable row level security;
alter table public.bet_votes enable row level security;

drop policy if exists "bets_select_all" on public.bets;
create policy "bets_select_all" on public.bets for select using (true);
drop policy if exists "bets_insert_public" on public.bets;
create policy "bets_insert_public" on public.bets for insert to anon, authenticated with check (true);
drop policy if exists "bets_update_public" on public.bets;
create policy "bets_update_public" on public.bets for update to anon, authenticated using (true) with check (true);
drop policy if exists "bets_delete_public" on public.bets;
create policy "bets_delete_public" on public.bets for delete to anon, authenticated using (true);

drop policy if exists "bet_votes_select_all" on public.bet_votes;
create policy "bet_votes_select_all" on public.bet_votes for select using (true);
drop policy if exists "bet_votes_insert_public" on public.bet_votes;
create policy "bet_votes_insert_public" on public.bet_votes for insert to anon, authenticated with check (true);
drop policy if exists "bet_votes_update_public" on public.bet_votes;
create policy "bet_votes_update_public" on public.bet_votes for update to anon, authenticated using (true) with check (true);
drop policy if exists "bet_votes_delete_public" on public.bet_votes;
create policy "bet_votes_delete_public" on public.bet_votes for delete to anon, authenticated using (true);
