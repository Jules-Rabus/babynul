-- (Obsolète depuis le passage en mode sans auth - conservé pour historique)
-- Si l'auth Supabase est réactivée un jour, ce trigger crée automatiquement
-- un profil joueur à la 1re connexion en lisant le prénom du raw_user_meta_data.

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_auth_user();
