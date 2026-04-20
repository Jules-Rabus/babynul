export const ELO_K = 32;

export function expectedScore(ra: number, rb: number) {
  return 1 / (1 + Math.pow(10, (rb - ra) / 400));
}

export function eloDelta(ra: number, rb: number, actualA: 0 | 1, k = ELO_K) {
  return Math.round(k * (actualA - expectedScore(ra, rb)));
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
