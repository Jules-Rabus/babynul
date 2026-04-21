-- Voice prompt config : une seule ligne éditée depuis l'UI admin pour
-- personnaliser le prompt du voice mode sans redéployer.

create table if not exists public.voice_prompt_config (
  id int primary key default 1,
  intro text not null,
  goat_template text not null,
  roast_template text not null,
  mixed_template text not null,
  updated_at timestamptz not null default now(),
  constraint voice_prompt_config_singleton check (id = 1)
);

-- Valeurs par défaut (synchronisées avec DEFAULT_VOICE_TEMPLATES dans
-- src/lib/voice/build-announce-prompt.ts).
insert into public.voice_prompt_config (id, intro, goat_template, roast_template, mixed_template)
values (
  1,
  E'Tu es le commentateur officiel du baby-foot de bureau Babynul.\nAnnonce le prochain match dans un style de speaker de sport, en français, tutoiement, ton vif et drôle.\nLa phrase doit durer ~6 à 10 secondes quand elle est lue.\nUtilise les audio tags entre crochets pour moduler la voix : [excited], [pause], [teasing], [laughing].\nN''ajoute aucun commentaire méta, sors juste la phrase prête à être lue.',
  'MODE GOAT : {names}. Fais une intro épique, couronne-les, exagère leur domination.',
  E'MODE ROAST : {names}. Chambre-les gentiment, pique mais reste bon-enfant. Genre : "aujourd''hui c''est peut-être le bon jour ?"',
  'Narration épique : un David vs Goliath, un combat entre champion et revenant, joue là-dessus.'
)
on conflict (id) do nothing;

alter table public.voice_prompt_config enable row level security;

create policy "voice_prompt_select_all" on public.voice_prompt_config for select using (true);
create policy "voice_prompt_insert_public" on public.voice_prompt_config for insert to anon, authenticated with check (true);
create policy "voice_prompt_update_public" on public.voice_prompt_config for update to anon, authenticated using (true) with check (true);
