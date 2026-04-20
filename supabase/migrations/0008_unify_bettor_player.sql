-- Unification : le parieur = un joueur existant (on choisit qui on est).
-- On remplace bettor_key/bettors par player_id partout.

-- 1. Ajouter les compteurs pari sur la table players
alter table public.players
  add column if not exists wager_balance int not null default 1000,
  add column if not exists wager_total_won int not null default 0,
  add column if not exists wager_total_lost int not null default 0,
  add column if not exists wager_bets_placed int not null default 0,
  add column if not exists wager_bets_won int not null default 0;

-- 2. Recréer wagers avec player_id
drop table if exists public.wagers cascade;

create table public.wagers (
  id uuid primary key default gen_random_uuid(),
  proposed_match_id uuid not null references public.proposed_matches(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  side text not null check (side in ('A','B')),
  stake int not null check (stake > 0),
  odds numeric(5,2) not null,
  payout int,
  status text not null default 'pending' check (status in ('pending','won','lost','refunded')),
  created_at timestamptz not null default now(),
  unique (proposed_match_id, player_id)
);

create index if not exists wagers_proposed_match_idx on public.wagers (proposed_match_id);
create index if not exists wagers_player_idx on public.wagers (player_id);

alter table public.wagers enable row level security;

create policy "wagers_select_all" on public.wagers for select using (true);
create policy "wagers_insert_public" on public.wagers for insert to anon, authenticated with check (true);
create policy "wagers_update_public" on public.wagers for update to anon, authenticated using (true) with check (true);
create policy "wagers_delete_public" on public.wagers for delete to anon, authenticated using (true);

-- 3. Supprimer bettors (plus utilisée)
drop table if exists public.bettors cascade;

-- 4. Recréer place_wager avec player_id + fix condition de course (variables dédiées)
drop function if exists public.place_wager(text, text, uuid, text, int);

create or replace function public.place_wager(
  p_player_id uuid,
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
  v_balance int;
  v_old_stake int;
begin
  if p_side not in ('A','B') then raise exception 'Côté invalide'; end if;
  if p_stake <= 0 then raise exception 'Mise invalide'; end if;

  select * into v_match from public.proposed_matches where id = p_proposed_match_id for update;
  if v_match.id is null then raise exception 'Match introuvable'; end if;
  if v_match.status <> 'open' then raise exception 'Paris clôturés sur ce match'; end if;

  -- Verrou sur le joueur pour éviter les races
  select wager_balance into v_balance from public.players where id = p_player_id for update;
  if v_balance is null then raise exception 'Joueur introuvable'; end if;

  -- Cote figée au moment du pari
  v_odds := case when p_side = 'A'
    then public.elo_odds(v_match.elo_a, v_match.elo_b)
    else public.elo_odds(v_match.elo_b, v_match.elo_a) end;

  -- Remplacer une mise existante sur le même match : rembourser d'abord
  v_old_stake := null;
  delete from public.wagers
    where proposed_match_id = p_proposed_match_id and player_id = p_player_id
    returning stake into v_old_stake;

  if v_old_stake is not null then
    v_balance := v_balance + v_old_stake;
    update public.players
      set wager_balance = v_balance,
          wager_bets_placed = greatest(0, wager_bets_placed - 1)
      where id = p_player_id;
  end if;

  if v_balance < p_stake then raise exception 'Solde insuffisant (%)', v_balance; end if;

  update public.players
    set wager_balance = v_balance - p_stake,
        wager_bets_placed = wager_bets_placed + 1
    where id = p_player_id;

  insert into public.wagers (proposed_match_id, player_id, side, stake, odds)
  values (p_proposed_match_id, p_player_id, p_side, p_stake, v_odds)
  returning id into v_wager_id;

  return v_wager_id;
end; $$;

-- 5. Recréer resolve_proposed_match avec player_id
drop function if exists public.resolve_proposed_match(uuid, text, uuid);

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
  select status into v_status from public.proposed_matches where id = p_proposed_match_id for update;
  if v_status is null then raise exception 'Match introuvable'; end if;
  if v_status <> 'open' then return; end if;

  for w in
    select * from public.wagers where proposed_match_id = p_proposed_match_id and status = 'pending'
  loop
    if w.side = p_winner_side then
      v_payout := round(w.stake * w.odds);
      update public.wagers set status = 'won', payout = v_payout where id = w.id;
      update public.players
        set wager_balance = wager_balance + v_payout,
            wager_total_won = wager_total_won + (v_payout - w.stake),
            wager_bets_won = wager_bets_won + 1
        where id = w.player_id;
    else
      update public.wagers set status = 'lost', payout = 0 where id = w.id;
      update public.players
        set wager_total_lost = wager_total_lost + w.stake
        where id = w.player_id;
    end if;
  end loop;

  update public.proposed_matches
    set status = 'resolved', winner_side = p_winner_side,
        match_id = coalesce(p_match_id, match_id),
        resolved_at = now()
    where id = p_proposed_match_id;
end; $$;

-- 6. Recréer cancel_proposed_match avec player_id
drop function if exists public.cancel_proposed_match(uuid);

create or replace function public.cancel_proposed_match(p_proposed_match_id uuid)
returns void language plpgsql security definer
set search_path = public
as $$
declare
  v_status text;
  w record;
begin
  select status into v_status from public.proposed_matches where id = p_proposed_match_id for update;
  if v_status is null then raise exception 'Match introuvable'; end if;
  if v_status <> 'open' then return; end if;

  for w in select * from public.wagers where proposed_match_id = p_proposed_match_id and status = 'pending'
  loop
    update public.wagers set status = 'refunded', payout = w.stake where id = w.id;
    update public.players
      set wager_balance = wager_balance + w.stake,
          wager_bets_placed = greatest(0, wager_bets_placed - 1)
      where id = w.player_id;
  end loop;

  update public.proposed_matches set status = 'cancelled' where id = p_proposed_match_id;
end; $$;

grant execute on function public.place_wager(uuid, uuid, text, int) to anon, authenticated;
grant execute on function public.resolve_proposed_match(uuid, text, uuid) to anon, authenticated;
grant execute on function public.cancel_proposed_match(uuid) to anon, authenticated;

-- 7. Fix undo_last_match : verrou + détachement propre des proposed_matches
create or replace function public.undo_last_match()
returns uuid language plpgsql security definer
set search_path = public
as $$
declare
  v_m public.matches;
  v_proposed_ids uuid[];
begin
  -- Atomic : supprime le dernier match en un seul statement
  delete from public.matches
  where id = (
    select id from public.matches
    order by played_at desc
    limit 1
    for update skip locked
  )
  returning * into v_m;

  if v_m.id is null then raise exception 'Aucun match à annuler'; end if;

  -- Reverse deltas
  if v_m.mode = 'individual' then
    update public.players set elo = elo - v_m.elo_delta_a, games_played = greatest(0, games_played - 1)
      where id = v_m.player_a1_id;
    update public.players set elo = elo - v_m.elo_delta_b, games_played = greatest(0, games_played - 1)
      where id = v_m.player_b1_id;
  else
    update public.players set elo = elo - v_m.elo_delta_a, games_played = greatest(0, games_played - 1)
      where id in (v_m.player_a1_id, v_m.player_a2_id);
    update public.players set elo = elo - v_m.elo_delta_b, games_played = greatest(0, games_played - 1)
      where id in (v_m.player_b1_id, v_m.player_b2_id);
    if v_m.team_elo_delta_a is not null then
      update public.teams set elo = elo - v_m.team_elo_delta_a, games_played = greatest(0, games_played - 1)
        where id = v_m.team_a_id;
      update public.teams set elo = elo - v_m.team_elo_delta_b, games_played = greatest(0, games_played - 1)
        where id = v_m.team_b_id;
    end if;
  end if;

  -- Si ce match était lié à un proposed_match résolu, rembourser les parieurs et rouvrir
  select array_agg(id) into v_proposed_ids
    from public.proposed_matches where match_id = v_m.id;

  if v_proposed_ids is not null then
    for i in 1 .. array_length(v_proposed_ids, 1) loop
      -- Rembourser et remettre en 'open' pour éviter l'incohérence
      update public.wagers
        set status = 'refunded', payout = stake
        where proposed_match_id = v_proposed_ids[i] and status in ('won','lost');

      -- Ajuster les soldes : annuler les payouts et les pertes
      update public.players p
        set wager_balance = p.wager_balance + w.stake - coalesce(w.payout, 0),
            wager_total_won = greatest(0, p.wager_total_won - greatest(0, coalesce(w.payout, 0) - w.stake)),
            wager_total_lost = case when w.side <> (select winner_side from public.proposed_matches where id = v_proposed_ids[i])
                                    then greatest(0, p.wager_total_lost - w.stake)
                                    else p.wager_total_lost end,
            wager_bets_won = case when w.side = (select winner_side from public.proposed_matches where id = v_proposed_ids[i])
                                  then greatest(0, p.wager_bets_won - 1)
                                  else p.wager_bets_won end
        from public.wagers w
        where w.proposed_match_id = v_proposed_ids[i] and w.player_id = p.id and w.status = 'refunded';

      update public.proposed_matches
        set status = 'cancelled', match_id = null, winner_side = null, resolved_at = null
        where id = v_proposed_ids[i];
    end loop;
  end if;

  return v_m.id;
end; $$;

grant execute on function public.undo_last_match() to anon, authenticated;

-- 8. Supprimer les tables de sondages (on retire la feature)
drop table if exists public.bet_votes cascade;
drop table if exists public.bets cascade;
