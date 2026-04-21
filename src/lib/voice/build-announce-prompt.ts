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
 * Construit le prompt pour le LLM, en injectant les modes GOAT/Roast
 * quand un joueur est en série. Le LLM renvoie ensuite une phrase
 * destinée au TTS (avec audio tags en crochets).
 */
export function buildAnnouncePrompt(ctx: AnnounceContext): string {
  const players = [...ctx.teamA, ...ctx.teamB];

  const goats = players.filter((p) => p.form.kind === "goat");
  const roasts = players.filter((p) => p.form.kind === "roast");

  const teamLabel = (team: AnnouncePlayer[]) =>
    team.map((p) => p.name).join(" et ");

  const base = [
    "Tu es le commentateur officiel du baby-foot de bureau Babynul.",
    "Annonce le prochain match dans un style de speaker de sport, en français, tutoiement, ton vif et drôle.",
    "La phrase doit durer ~6 à 10 secondes quand elle est lue.",
    "Utilise les audio tags entre crochets pour moduler la voix : [excited], [pause], [teasing], [laughing].",
    "N'ajoute aucun commentaire méta, sors juste la phrase prête à être lue.",
    "",
    `Équipe A : ${teamLabel(ctx.teamA)}`,
    `Équipe B : ${teamLabel(ctx.teamB)}`,
  ];

  if (goats.length > 0) {
    const g = goats
      .map((p) => `${p.name} (${p.form.kind === "goat" ? p.form.streak : 0} victoires d'affilée)`)
      .join(", ");
    base.push("");
    base.push(`MODE GOAT : ${g}. Fais une intro épique, couronne-les, exagère leur domination.`);
  }

  if (roasts.length > 0) {
    const r = roasts
      .map((p) => `${p.name} (${p.form.kind === "roast" ? p.form.streak : 0} défaites d'affilée)`)
      .join(", ");
    base.push("");
    base.push(
      `MODE ROAST : ${r}. Chambre-les gentiment, pique mais reste bon-enfant. Genre : "aujourd'hui c'est peut-être le bon jour ?"`,
    );
  }

  if (goats.length > 0 && roasts.length > 0) {
    base.push("");
    base.push(
      "Narration épique : un David vs Goliath, un combat entre champion et revenant, joue là-dessus.",
    );
  }

  return base.join("\n");
}

/**
 * Choix d'un audio tag par défaut selon le mix de formes.
 */
export function pickAudioStyle(ctx: AnnounceContext): "excited" | "teasing" | "neutral" {
  const players = [...ctx.teamA, ...ctx.teamB];
  const hasGoat = players.some((p) => p.form.kind === "goat");
  const hasRoast = players.some((p) => p.form.kind === "roast");
  if (hasGoat && !hasRoast) return "excited";
  if (hasRoast && !hasGoat) return "teasing";
  return hasGoat ? "excited" : "neutral";
}
