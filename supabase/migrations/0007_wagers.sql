-- Paris gambling avec cotes Elo sur matchs du matchmaking.
-- Tables : proposed_matches (générés par admin), bettors (solde par device),
-- wagers (mise d'un bettor sur un match proposé).

-- Matchs persistés depuis l'onglet Matchmaking (un admin clique "Générer + ouvrir les paris")
create table if not exists public.proposed_matches (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('individual','team')),
  team_a_p1 uuid not null references public.players(id) on delete cascade,
  team_a_p2 uuid references public.players(id) on delete cascade,
  team_b_p1 uuid not null references public.players(id) on delete cascade,
  team_b_p2 uuid references public.players(id) on delete cascade,
  -- Elos figés au moment de la proposition (pour calculer les cotes de façon stable)
  elo_a int not null,
  elo_b int not null,
  -- Lien vers le match joué une fois saisi
  match_id uuid references public.matches(id) on delete set null,
  status text not null default 'open' check (status in ('open','resolved','cancelled')),
  winner_side text check (winner_side in ('A','B')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists proposed_matches_status_idx on public.proposed_matches (status, created_at desc);

-- Profil parieur : identifié par un bettor_key (cookie localStorage côté client)
create table if not exists public.bettors (
  bettor_key text primary key,
  nickname text,
  balance int not null default 1000,
  total_won int not null default 0,
  total_lost int not null default 0,
  bets_placed int not null default 0,
  bets_won int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bettors_balance_idx on public.bettors (balance desc);

-- Mise individuelle
create table if not exists public.wagers (
  id uuid primary key default gen_random_uuid(),
  proposed_match_id uuid not null references public.proposed_matches(id) on delete cascade,
  bettor_key text not null references public.bettors(bettor_key) on delete cascade,
  side text not null check (side in ('A','B')),
  stake int not null check (stake > 0),
  odds numeric(5,2) not null,       -- cote au moment du pari (figée)
  payout int,                        -- calculé à la résolution
  status text not null default 'pending' check (status in ('pending','won','lost','refunded')),
  created_at timestamptz not null default now(),
  unique (proposed_match_id, bettor_key)
);

create index if not exists wagers_proposed_match_idx on public.wagers (proposed_match_id);
create index if not exists wagers_bettor_idx on public.wagers (bettor_key);

alter table public.proposed_matches enable row level security;
alter table public.bettors enable row level security;
alter table public.wagers enable row level security;

-- Lecture publique
create policy "proposed_matches_select_all" on public.proposed_matches for select using (true);
create policy "bettors_select_all" on public.bettors for select using (true);
create policy "wagers_select_all" on public.wagers for select using (true);

-- Écritures ouvertes (gate UI admin pour proposed_matches, les wagers sont libres)
create policy "proposed_matches_insert_public" on public.proposed_matches for insert to anon, authenticated with check (true);
create policy "proposed_matches_update_public" on public.proposed_matches for update to anon, authenticated using (true) with check (true);
create policy "proposed_matches_delete_public" on public.proposed_matches for delete to anon, authenticated using (true);

create policy "bettors_insert_public" on public.bettors for insert to anon, authenticated with check (true);
create policy "bettors_update_public" on public.bettors for update to anon, authenticated using (true) with check (true);

create policy "wagers_insert_public" on public.wagers for insert to anon, authenticated with check (true);
create policy "wagers_update_public" on public.wagers for update to anon, authenticated using (true) with check (true);
create policy "wagers_delete_public" on public.wagers for delete to anon, authenticated using (true);

-- Fonction helper : cote = 1 / P(gagne) avec marge 5%
create or replace function public.elo_odds(ra int, rb int)
returns numeric language sql immutable
set search_path = public
as $$
  select round(1.05 / (1.0 / (1.0 + power(10, (rb - ra)::numeric / 400.0))), 2);
$$;

-- Placer un pari : débite le solde, crée la ligne wagers
create or replace function public.place_wager(
  p_bettor_key text,
  p_nickname text,
  p_proposed_match_id uuid,
  p_side text,
  p_stake int
) returns uuid language plpgsql security definer
set search_path = public
as $$
declare
  v_match public.proposed_matches;
  v_odds numeric;
  v_wager_id uuid;
  v_current_balance int;
begin
  if p_side not in ('A','B') then raise exception 'Côté invalide'; end if;
  if p_stake <= 0 then raise exception 'Mise invalide'; end if;

  select * into v_match from public.proposed_matches where id = p_proposed_match_id;
  if v_match.id is null then raise exception 'Match introuvable'; end if;
  if v_match.status <> 'open' then raise exception 'Les paris sont clôturés sur ce match'; end if;

  -- Créer le parieur si inexistant avec solde initial 1000
  insert into public.bettors (bettor_key, nickname, balance)
  values (p_bettor_key, coalesce(p_nickname, 'Anonyme'), 1000)
  on conflict (bettor_key) do update
    set nickname = coalesce(excluded.nickname, public.bettors.nickname),
        updated_at = now();

  select balance into v_current_balance from public.bettors where bettor_key = p_bettor_key;
  if v_current_balance < p_stake then raise exception 'Solde insuffisant (%)', v_current_balance; end if;

  -- Cote figée
  v_odds := case when p_side = 'A'
    then public.elo_odds(v_match.elo_a, v_match.elo_b)
    else public.elo_odds(v_match.elo_b, v_match.elo_a) end;

  -- Remplacer la mise existante sur le même match (remboursement de l'ancienne)
  delete from public.wagers where proposed_match_id = p_proposed_match_id and bettor_key = p_bettor_key
    returning stake into v_current_balance;
  if v_current_balance is not null then
    update public.bettors set balance = balance + v_current_balance, updated_at = now()
      where bettor_key = p_bettor_key;
  end if;

  -- Débiter et insérer
  update public.bettors
    set balance = balance - p_stake,
        bets_placed = bets_placed + 1,
        updated_at = now()
    where bettor_key = p_bettor_key;

  insert into public.wagers (proposed_match_id, bettor_key, side, stake, odds)
  values (p_proposed_match_id, p_bettor_key, p_side, p_stake, v_odds)
  returning id into v_wager_id;

  return v_wager_id;
end; $$;

-- Résoudre un match proposé : payouts et mise à jour des soldes
create or replace function public.resolve_proposed_match(
  p_proposed_match_id uuid,
  p_winner_side text,
  p_match_id uuid default null
) returns void language plpgsql security definer
set search_path = public
as $$
declare
  v_status text;
  w record;
  v_payout int;
begin
  if p_winner_side not in ('A','B') then raise exception 'Côté invalide'; end if;
  select status into v_status from public.proposed_matches where id = p_proposed_match_id;
  if v_status is null then raise exception 'Match introuvable'; end if;
  if v_status <> 'open' then return; end if;

  for w in
    select * from public.wagers where proposed_match_id = p_proposed_match_id and status = 'pending'
  loop
    if w.side = p_winner_side then
      v_payout := round(w.stake * w.odds);
      update public.wagers set status = 'won', payout = v_payout where id = w.id;
      update public.bettors
        set balance = balance + v_payout,
            total_won = total_won + (v_payout - w.stake),
            bets_won = bets_won + 1,
            updated_at = now()
        where bettor_key = w.bettor_key;
    else
      update public.wagers set status = 'lost', payout = 0 where id = w.id;
      update public.bettors
        set total_lost = total_lost + w.stake,
            updated_at = now()
        where bettor_key = w.bettor_key;
    end if;
  end loop;

  update public.proposed_matches
    set status = 'resolved', winner_side = p_winner_side,
        match_id = coalesce(p_match_id, match_id),
        resolved_at = now()
    where id = p_proposed_match_id;
end; $$;

-- Annuler un match proposé : rembourser toutes les mises
create or replace function public.cancel_proposed_match(p_proposed_match_id uuid)
returns void language plpgsql security definer
set search_path = public
as $$
declare
  v_status text;
  w record;
begin
  select status into v_status from public.proposed_matches where id = p_proposed_match_id;
  if v_status is null then raise exception 'Match introuvable'; end if;
  if v_status <> 'open' then return; end if;

  for w in select * from public.wagers where proposed_match_id = p_proposed_match_id and status = 'pending'
  loop
    update public.wagers set status = 'refunded', payout = w.stake where id = w.id;
    update public.bettors
      set balance = balance + w.stake,
          bets_placed = greatest(0, bets_placed - 1),
          updated_at = now()
      where bettor_key = w.bettor_key;
  end loop;

  update public.proposed_matches set status = 'cancelled' where id = p_proposed_match_id;
end; $$;

grant execute on function public.elo_odds(int, int) to anon, authenticated;
grant execute on function public.place_wager(text, text, uuid, text, int) to anon, authenticated;
grant execute on function public.resolve_proposed_match(uuid, text, uuid) to anon, authenticated;
grant execute on function public.cancel_proposed_match(uuid) to anon, authenticated;
