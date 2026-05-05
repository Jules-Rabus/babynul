export const ELO_K = 32;

/** Multiplicateur appliqué aux deux deltas quand le match se joue à 1 point d'écart (3-2, 10-9). */
export const CLOSE_MATCH_FACTOR = 0.7;

/** Intensité de la redistribution intra-équipe en mode 2v2. 0 = égalitaire, 1 = très marqué. */
export const TEAM_CARRY_ALPHA = 0.4;

/** Borne de l'écart intra-équipe (en multiples de 400 Elo) pour éviter les facteurs extrêmes. */
export const TEAM_CARRY_SPREAD_CAP = 1;

export function expectedScore(ra: number, rb: number) {
  return 1 / (1 + Math.pow(10, (rb - ra) / 400));
}

export function eloDelta(ra: number, rb: number, actualA: 0 | 1, k = ELO_K) {
  return Math.round(k * (actualA - expectedScore(ra, rb)));
}

/**
 * Delta ELO pondéré par la marge de buts (miroir de public.elo_delta_weighted en SQL).
 * - margin_mult = ln(|margin| + 1) : amplifie les gros écarts de buts.
 * - dampener    = 2.2 / ((ΔELO signé gagnant-perdant)/400 + 2.2) :
 *   tempère les stomps du favori et amplifie l'upset de l'outsider.
 * - closeness   = 0.7 si margin === 1 sinon 1 : 3-2 / 10-9 vaut moins qu'une vraie démo.
 */
export function eloDeltaWeighted(
  ra: number,
  rb: number,
  scoreA: number,
  scoreB: number,
  k = ELO_K,
): number {
  const margin = Math.abs(scoreA - scoreB);
  if (margin <= 0) return 0;
  const actualA = scoreA > scoreB ? 1 : 0;
  const expected = expectedScore(ra, rb);
  const winnerR = actualA === 1 ? ra : rb;
  const loserR = actualA === 1 ? rb : ra;
  const dElo = winnerR - loserR;
  const marginMult = Math.log(margin + 1);
  const dampener = 2.2 / (dElo / 400 + 2.2);
  const closeness = margin === 1 ? CLOSE_MATCH_FACTOR : 1;
  return Math.round(k * marginMult * dampener * closeness * (actualA - expected));
}

/**
 * Redistribue le delta ELO d'équipe entre les 2 coéquipiers selon leur écart à la moyenne.
 * Le porteur (Elo > moyenne) :
 *   - perd moins quand l'équipe perd ;
 *   - gagne plus quand l'équipe gagne (carry récompensé).
 * Le coéquipier en dessous de la moyenne fait le miroir.
 *
 * Conservation : delta1 + delta2 = 2 × deltaTeam (renormalisation après arrondis).
 * Miroir SQL : public.distribute_team_delta dans la migration 0016.
 */
export function distributeTeamDelta(
  deltaTeam: number,
  eloP1: number,
  eloP2: number,
  alpha = TEAM_CARRY_ALPHA,
): [number, number] {
  if (deltaTeam === 0) return [0, 0];
  const avg = (eloP1 + eloP2) / 2;
  const rawSpread1 = (eloP1 - avg) / 400;
  const spread1 = Math.max(-TEAM_CARRY_SPREAD_CAP, Math.min(TEAM_CARRY_SPREAD_CAP, rawSpread1));
  const spread2 = -spread1;
  const isLoss = deltaTeam < 0;
  const f1 = isLoss ? 1 - alpha * spread1 : 1 + alpha * spread1;
  const f2 = isLoss ? 1 - alpha * spread2 : 1 + alpha * spread2;
  const target = 2 * deltaTeam;
  const raw = deltaTeam * f1 + deltaTeam * f2;
  const norm = raw === 0 ? 1 : target / raw;
  const d1 = Math.round(deltaTeam * f1 * norm);
  const d2 = target - d1;
  return [d1, d2];
}

export const ELO_PRESETS = {
  faible: 800,
  moyen: 1000,
  fort: 1200,
} as const;

export type EloPreset = keyof typeof ELO_PRESETS;

// Cote parieur : 1 / P(gagne) avec marge 5% (overround)
export function eloOdds(ra: number, rb: number): number {
  return Math.round((1.05 / expectedScore(ra, rb)) * 100) / 100;
}
