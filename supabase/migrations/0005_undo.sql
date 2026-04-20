-- Undo last match : reverse les deltas Elo du dernier match joué.

create or replace function public.undo_last_match()
returns uuid language plpgsql security definer
set search_path = public
as $$
declare
  v_m public.matches;
begin
  select * into v_m from public.matches order by played_at desc limit 1;
  if v_m.id is null then raise exception 'Aucun match à annuler'; end if;

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

  delete from public.matches where id = v_m.id;
  return v_m.id;
end; $$;

grant execute on function public.undo_last_match() to anon, authenticated;
