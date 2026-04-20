-- Auto-création d'un profil player à la première connexion Google

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_first text;
  v_last text;
  v_full text;
begin
  v_first := coalesce(meta->>'given_name', meta->>'first_name');
  v_last := coalesce(meta->>'family_name', meta->>'last_name');
  v_full := coalesce(meta->>'full_name', meta->>'name');

  if (v_first is null or v_first = '') and v_full is not null then
    v_first := split_part(v_full, ' ', 1);
    v_last := nullif(trim(substring(v_full from position(' ' in v_full) + 1)), '');
  end if;

  if v_first is null or v_first = '' then
    v_first := split_part(coalesce(new.email, 'Joueur'), '@', 1);
  end if;

  if v_last is null or v_last = '' then
    v_last := '';
  end if;

  insert into public.players (auth_user_id, first_name, last_name, elo, games_played)
  values (new.id, v_first, v_last, 1000, 0)
  on conflict (auth_user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();
