export const ELO_K = 32;

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
  return Math.round(k * marginMult * dampener * (actualA - expected));
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
