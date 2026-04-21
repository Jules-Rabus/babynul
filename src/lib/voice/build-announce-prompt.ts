import type { PlayerForm } from "./player-form";

export type AnnouncePlayer = {
  id: string;
  name: string; // surnom si dispo, sinon prénom
  form: PlayerForm;
};

export type AnnounceContext = {
  teamA: AnnouncePlayer[];
  teamB: AnnouncePlayer[];
};

/**
 * Templates éditables depuis l'UI admin. Placeholders supportés :
 *   {names}  → liste des joueurs concernés avec leur streak
 *              ex. "Jules (3 victoires), Marie (4 victoires)"
 *   {streak} → streak du premier joueur concerné (raccourci pratique)
 */
export type VoicePromptTemplates = {
  intro: string;
  goat_template: string;
  roast_template: string;
  mixed_template: string;
};

export const DEFAULT_VOICE_TEMPLATES: VoicePromptTemplates = {
  intro: [
    "Tu es le commentateur officiel du baby-foot de bureau Babynul.",
    "Annonce le prochain match dans un style de speaker de sport, en français, tutoiement, ton vif et drôle.",
    "La phrase doit durer ~6 à 10 secondes quand elle est lue.",
    "Utilise les audio tags entre crochets pour moduler la voix : [excited], [pause], [teasing], [laughing].",
    "N'ajoute aucun commentaire méta, sors juste la phrase prête à être lue.",
  ].join("\n"),
  goat_template:
    "MODE GOAT : {names}. Fais une intro épique, couronne-les, exagère leur domination.",
  roast_template:
    "MODE ROAST : {names}. Chambre-les gentiment, pique mais reste bon-enfant. Genre : \"aujourd'hui c'est peut-être le bon jour ?\"",
  mixed_template:
    "Narration épique : un David vs Goliath, un combat entre champion et revenant, joue là-dessus.",
};

function namesOf(players: AnnouncePlayer[]): string {
  return players
    .map((p) => {
      if (p.form.kind === "goat") return `${p.name} (${p.form.streak} victoires d'affilée)`;
      if (p.form.kind === "roast") return `${p.name} (${p.form.streak} défaites d'affilée)`;
      return p.name;
    })
    .join(", ");
}

function fill(template: string, players: AnnouncePlayer[]): string {
  const names = namesOf(players);
  const first = players[0];
  const streak =
    first && (first.form.kind === "goat" || first.form.kind === "roast")
      ? String(first.form.streak)
      : "";
  return template.replace(/\{names\}/g, names).replace(/\{streak\}/g, streak);
}

/**
 * Construit le prompt LLM en combinant les templates (intro + éventuel GOAT/ROAST/mixed)
 * avec le contexte du match.
 */
export function buildAnnouncePrompt(
  ctx: AnnounceContext,
  templates: VoicePromptTemplates = DEFAULT_VOICE_TEMPLATES,
): string {
  const players = [...ctx.teamA, ...ctx.teamB];
  const goats = players.filter((p) => p.form.kind === "goat");
  const roasts = players.filter((p) => p.form.kind === "roast");

  const teamLabel = (team: AnnouncePlayer[]) => team.map((p) => p.name).join(" et ");

  const lines: string[] = [
    templates.intro,
    "",
    `Équipe A : ${teamLabel(ctx.teamA)}`,
    `Équipe B : ${teamLabel(ctx.teamB)}`,
  ];

  if (goats.length > 0) {
    lines.push("");
    lines.push(fill(templates.goat_template, goats));
  }

  if (roasts.length > 0) {
    lines.push("");
    lines.push(fill(templates.roast_template, roasts));
  }

  if (goats.length > 0 && roasts.length > 0) {
    lines.push("");
    lines.push(templates.mixed_template);
  }

  return lines.join("\n");
}

/**
 * Audio tag par défaut selon le mix de formes.
 */
export function pickAudioStyle(ctx: AnnounceContext): "excited" | "teasing" | "neutral" {
  const players = [...ctx.teamA, ...ctx.teamB];
  const hasGoat = players.some((p) => p.form.kind === "goat");
  const hasRoast = players.some((p) => p.form.kind === "roast");
  if (hasGoat && !hasRoast) return "excited";
  if (hasRoast && !hasGoat) return "teasing";
  return hasGoat ? "excited" : "neutral";
}
