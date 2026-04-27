-- Tournois persistés en base.
-- Scope :
--   * mode individuel (1v1) ou équipe (2v2)
--   * score cible configurable (ex. 3 points)
--   * bracket à élimination directe
--   * les matchs sont créés de façon LAZY : seul le premier tour existe au
--     démarrage ; le match `r-1` est créé uniquement quand ses deux feeders
--     sont connus. Ça évite d'encombrer l'UI avec des slots vides.
--   * un tournoi ⇒ plusieurs tournament_matches ⇒ chacun produit 1 match réel
--     dans `matches` (pour que l'ELO soit correctement mis à jour via record_match_v3).

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  label text,
  mode text not null check (mode in ('individual','team')),
  size int not null check (size >= 2),
  rounds int not null check (rounds >= 1),
  target_score int not null default 10 check (target_score between 1 and 30),
  status text not null default 'active' check (status in ('active','ended')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  champion_player_id uuid references public.players(id) on delete set null,
  champion_team_id uuid references public.teams(id) on delete set null,
  session_id uuid references public.play_sessions(id) on delete set null
);

create index if not exists tournaments_started_at_idx
  on public.tournaments (started_at desc);
create index if not exists tournaments_status_started_idx
  on public.tournaments (status, started_at desc);

-- Participants : un slot initial par équipe/joueur.
create table if not exists public.tournament_participants (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  slot int not null,
  seed int not null,
  player_id uuid references public.players(id) on delete set null,
  team_p1_id uuid references public.players(id) on delete set null,
  team_p2_id uuid references public.players(id) on delete set null,
  label text,
  primary key (tournament_id, slot)
);

create index if not exists tournament_participants_player_idx
  on public.tournament_participants (player_id);

-- Matches du bracket. Les feeders sont repérés par (tournament_id, round+1, slot*2[+1]).
-- winner_participant_slot pointe vers un slot de tournament_participants si le gagnant
-- est l'une des équipes initiales, sinon NULL (gagnant d'un feeder à propager).
create table if not exists public.tournament_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round int not null,
  slot int not null,
  side_a_slot int,
  side_b_slot int,
  winner_slot int,
  match_id uuid references public.matches(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','ready','played','bye')),
  unique (tournament_id, round, slot)
);

create index if not exists tournament_matches_status_idx
  on public.tournament_matches (tournament_id, status);

-- RLS minimale : lecture publique, écritures via RPC.
alter table public.tournaments enable row level security;
alter table public.tournament_participants enable row level security;
alter table public.tournament_matches enable row level security;

create policy "tournaments_select_all" on public.tournaments for select using (true);
create policy "tournaments_insert_public" on public.tournaments for insert to anon, authenticated with check (true);
create policy "tournaments_update_public" on public.tournaments for update to anon, authenticated using (true) with check (true);
create policy "tournaments_delete_public" on public.tournaments for delete to anon, authenticated using (true);

create policy "tournament_participants_select_all" on public.tournament_participants for select using (true);
create policy "tournament_participants_insert_public" on public.tournament_participants for insert to anon, authenticated with check (true);
create policy "tournament_participants_update_public" on public.tournament_participants for update to anon, authenticated using (true) with check (true);
create policy "tournament_participants_delete_public" on public.tournament_participants for delete to anon, authenticated using (true);

create policy "tournament_matches_select_all" on public.tournament_matches for select using (true);
create policy "tournament_matches_insert_public" on public.tournament_matches for insert to anon, authenticated with check (true);
create policy "tournament_matches_update_public" on public.tournament_matches for update to anon, authenticated using (true) with check (true);
create policy "tournament_matches_delete_public" on public.tournament_matches for delete to anon, authenticated using (true);

-- Helper : puissance de 2 >= n.
create or replace function public.tournament_bracket_size(n int)
returns int language sql immutable
as $$
  select greatest(2, pow(2, ceil(log(2, greatest(n,2))))::int);
$$;

-- RPC : create_tournament
-- p_mode ∈ ('individual','team')
-- p_slots : tableau JSON décrivant chaque équipe (ordre = slot) :
--   mode individual : [{"player_id":"..."},...]
--   mode team       : [{"p1":"...","p2":"..."}, ...]
-- p_target_score : score cible (défaut 10)
-- p_label / p_session_id : optionnels.
-- Les slots d'entrée sont tirés au sort aléatoirement par ordering random() avant assignation.
create or replace function public.create_tournament(
  p_mode text,
  p_slots jsonb,
  p_target_score int default 10,
  p_label text default null,
  p_session_id uuid default null
) returns uuid language plpgsql security definer
set search_path = public
as $$
declare
  v_tournament_id uuid;
  v_n int;
  v_bracket_size int;
  v_rounds int;
  v_entry jsonb;
  v_slot int;
  v_first_round_matches int;
  v_shuffled jsonb;
begin
  if p_mode not in ('individual','team') then raise exception 'Mode invalide: %', p_mode; end if;
  if p_target_score < 1 or p_target_score > 30 then raise exception 'target_score invalide'; end if;

  v_n := jsonb_array_length(p_slots);
  if v_n < 2 then raise exception 'Au moins 2 participants requis'; end if;
  v_bracket_size := public.tournament_bracket_size(v_n);
  v_rounds := ceil(log(2, v_bracket_size))::int;
  v_first_round_matches := v_bracket_size / 2;

  insert into public.tournaments (label, mode, size, rounds, target_score, session_id)
  values (p_label, p_mode, v_bracket_size, v_rounds, p_target_score, p_session_id)
  returning id into v_tournament_id;

  -- Tirage au sort : on mélange le tableau d'entrée.
  select jsonb_agg(x order by random()) into v_shuffled
  from jsonb_array_elements(p_slots) x;

  -- Inscrit les participants sur les v_n premiers slots (mélangés),
  -- les slots restants jusqu'à v_bracket_size sont des "bye" (pas de ligne).
  v_slot := 0;
  for v_entry in select * from jsonb_array_elements(v_shuffled)
  loop
    if p_mode = 'individual' then
      insert into public.tournament_participants
        (tournament_id, slot, seed, player_id, label)
      values (
        v_tournament_id, v_slot, v_slot,
        (v_entry->>'player_id')::uuid,
        v_entry->>'label'
      );
    else
      insert into public.tournament_participants
        (tournament_id, slot, seed, team_p1_id, team_p2_id, label)
      values (
        v_tournament_id, v_slot, v_slot,
        (v_entry->>'p1')::uuid,
        (v_entry->>'p2')::uuid,
        v_entry->>'label'
      );
    end if;
    v_slot := v_slot + 1;
  end loop;

  -- Crée les matches du PREMIER TOUR uniquement.
  -- round = v_rounds pour le premier tour (puis décroît jusqu'à 1 = finale).
  for v_slot in 0..(v_first_round_matches - 1) loop
    declare
      v_a_slot int := v_slot * 2;
      v_b_slot int := v_slot * 2 + 1;
      v_a_exists boolean;
      v_b_exists boolean;
      v_status text;
    begin
      select exists(select 1 from public.tournament_participants
                    where tournament_id = v_tournament_id and slot = v_a_slot) into v_a_exists;
      select exists(select 1 from public.tournament_participants
                    where tournament_id = v_tournament_id and slot = v_b_slot) into v_b_exists;
      if v_a_exists and v_b_exists then
        v_status := 'ready';
      elsif v_a_exists or v_b_exists then
        v_status := 'bye';
      else
        v_status := 'pending';
      end if;
      insert into public.tournament_matches
        (tournament_id, round, slot, side_a_slot, side_b_slot, status, winner_slot)
      values (
        v_tournament_id, v_rounds, v_slot,
        case when v_a_exists then v_a_slot end,
        case when v_b_exists then v_b_slot end,
        v_status,
        case when v_status = 'bye' then coalesce(
          case when v_a_exists then v_a_slot end,
          case when v_b_exists then v_b_slot end
        ) end
      );
    end;
  end loop;

  -- Cascade immédiate des byes vers le tour suivant.
  perform public.tournament_cascade_byes(v_tournament_id);

  return v_tournament_id;
end; $$;

grant execute on function public.create_tournament(text, jsonb, int, text, uuid) to anon, authenticated;

-- Helper : propage les byes résolus depuis `status = 'bye'` ou `status = 'played'`
-- vers le prochain tour, en créant les tournament_matches manquants au besoin.
create or replace function public.tournament_cascade_byes(p_tournament_id uuid)
returns void language plpgsql security definer
set search_path = public
as $$
declare
  v_rounds int;
  v_round int;
  v_m public.tournament_matches;
  v_next_round int;
  v_next_slot int;
  v_next public.tournament_matches;
  v_side text;
begin
  select rounds into v_rounds from public.tournaments where id = p_tournament_id;
  if v_rounds is null then return; end if;

  for v_round in reverse v_rounds..2 loop
    for v_m in select * from public.tournament_matches
                where tournament_id = p_tournament_id
                  and round = v_round
                  and winner_slot is not null
    loop
      v_next_round := v_round - 1;
      v_next_slot := v_m.slot / 2;
      v_side := case when v_m.slot % 2 = 0 then 'A' else 'B' end;

      select * into v_next from public.tournament_matches
       where tournament_id = p_tournament_id
         and round = v_next_round
         and slot = v_next_slot;

      if v_next.id is null then
        -- Pas encore créé : on l'insère.
        insert into public.tournament_matches
          (tournament_id, round, slot, side_a_slot, side_b_slot, status)
        values (
          p_tournament_id, v_next_round, v_next_slot,
          case when v_side = 'A' then v_m.winner_slot end,
          case when v_side = 'B' then v_m.winner_slot end,
          'pending'
        )
        returning * into v_next;
      else
        update public.tournament_matches
           set side_a_slot = case when v_side = 'A' then v_m.winner_slot else v_next.side_a_slot end,
               side_b_slot = case when v_side = 'B' then v_m.winner_slot else v_next.side_b_slot end
         where id = v_next.id
        returning * into v_next;
      end if;

      -- Si les deux côtés sont connus et aucun match n'a encore été joué, c'est 'ready'.
      if v_next.side_a_slot is not null and v_next.side_b_slot is not null and v_next.match_id is null then
        update public.tournament_matches set status = 'ready' where id = v_next.id;
      end if;
    end loop;
  end loop;
end; $$;

grant execute on function public.tournament_cascade_byes(uuid) to anon, authenticated;

-- RPC : record_tournament_match
-- Joue un match du tournoi, appelle record_match_v3 (ELO pondéré), lie le match réel,
-- positionne le winner_slot et propage au tour suivant.
create or replace function public.record_tournament_match(
  p_tournament_match_id uuid,
  p_score_a int,
  p_score_b int
) returns uuid language plpgsql security definer
set search_path = public
as $$
declare
  v_tm public.tournament_matches;
  v_t  public.tournaments;
  v_pa public.tournament_participants;
  v_pb public.tournament_participants;
  v_match_id uuid;
  v_winner_slot int;
begin
  select * into v_tm from public.tournament_matches where id = p_tournament_match_id for update;
  if v_tm.id is null then raise exception 'Match de tournoi introuvable'; end if;
  if v_tm.status = 'played' then raise exception 'Match déjà joué'; end if;
  if v_tm.side_a_slot is null or v_tm.side_b_slot is null then
    raise exception 'Adversaire(s) non encore connus';
  end if;
  if p_score_a = p_score_b then raise exception 'Match nul non supporté'; end if;

  select * into v_t from public.tournaments where id = v_tm.tournament_id;
  if v_t.status = 'ended' then raise exception 'Tournoi terminé'; end if;
  if greatest(p_score_a, p_score_b) <> v_t.target_score then
    raise exception 'Le vainqueur doit atteindre % (score cible)', v_t.target_score;
  end if;

  select * into v_pa from public.tournament_participants
   where tournament_id = v_tm.tournament_id and slot = v_tm.side_a_slot;
  select * into v_pb from public.tournament_participants
   where tournament_id = v_tm.tournament_id and slot = v_tm.side_b_slot;

  if v_t.mode = 'individual' then
    v_match_id := public.record_match_v3(
      'individual', v_pa.player_id, null, v_pb.player_id, null,
      p_score_a, p_score_b, v_t.session_id
    );
  else
    v_match_id := public.record_match_v3(
      'team', v_pa.team_p1_id, v_pa.team_p2_id, v_pb.team_p1_id, v_pb.team_p2_id,
      p_score_a, p_score_b, v_t.session_id
    );
  end if;

  v_winner_slot := case when p_score_a > p_score_b then v_tm.side_a_slot else v_tm.side_b_slot end;

  update public.tournament_matches
     set status = 'played', match_id = v_match_id, winner_slot = v_winner_slot
   where id = v_tm.id;

  perform public.tournament_cascade_byes(v_t.id);

  -- Si c'était la finale, clôture le tournoi.
  if v_tm.round = 1 then
    declare
      v_winner public.tournament_participants;
    begin
      select * into v_winner from public.tournament_participants
       where tournament_id = v_t.id and slot = v_winner_slot;
      update public.tournaments
         set status = 'ended',
             ended_at = now(),
             champion_player_id = case when v_t.mode = 'individual' then v_winner.player_id end
       where id = v_t.id;
    end;
  end if;

  return v_match_id;
end; $$;

grant execute on function public.record_tournament_match(uuid, int, int) to anon, authenticated;

-- RPC : end_tournament (clôture manuelle, sans désigner de champion).
create or replace function public.end_tournament(p_tournament_id uuid)
returns void language plpgsql security definer
set search_path = public
as $$
begin
  update public.tournaments
     set status = 'ended', ended_at = now()
   where id = p_tournament_id and status = 'active';
end; $$;

grant execute on function public.end_tournament(uuid) to anon, authenticated;
