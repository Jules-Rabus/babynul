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
    "### DIRECTOR'S NOTES",
    "Style : commentateur officiel du baby-foot de bureau Babynul, français,",
    "tutoiement, ton vif et drôle de speaker sportif, avec punchlines.",
    "Pacing : débit rapide mais articulé, 6 à 10 secondes de lecture.",
    "Accent : français standard.",
    "",
    "### AUDIO TAGS",
    "Utilise 1 à 3 audio tags inline entre crochets pour moduler la voix.",
    "Tags Gemini reconnus : [excited], [shouting], [whispers], [laughs],",
    "[sighs], [sarcastically], [teasing], [short pause], [long pause].",
    "Exemple : \"[excited] Allez c'est parti ! [short pause] Jules, tenant du titre...\"",
    "N'utilise JAMAIS de balises XML-like (<emotion>, <pace>, <emphasis>) — elles",
    "ne sont pas interprétées par ce moteur.",
    "",
    "### SORTIE",
    "Sors uniquement la phrase prête à être lue, sans préambule ni guillemets.",
  ].join("\n"),
  goat_template:
    "MODE GOAT : {names}. Fais une intro épique, couronne-les, exagère leur domination. Place un [excited] ou [shouting] au bon moment.",
  roast_template:
    "MODE ROAST : {names}. Chambre-les gentiment avec un [teasing] ou [sarcastically]. Reste bon-enfant. Genre : \"aujourd'hui c'est peut-être le bon jour ?\"",
  mixed_template:
    "Narration épique : un David vs Goliath, un combat entre champion et revenant. Joue le contraste avec un [short pause] entre les deux camps.",
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
