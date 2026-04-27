import { pairKey } from "@/lib/pairs";

export type PairingPlayer = {
  id: string;
  elo?: number;
};

export type Pair = [PairingPlayer, PairingPlayer];

export type BuildPairsOptions = {
  /**
   * Paires déjà vues (clés canoniques). Les combinaisons utilisant ces paires
   * sont pénalisées, sans être interdites si aucune alternative "fraîche" n'existe.
   */
  seenPairs?: Set<string>;
  /**
   * Biais RNG [0..1). Par défaut `Math.random()`.
   */
  rng?: () => number;
};

/**
 * Construit un ensemble de paires à partir d'une liste de joueurs (nombre pair),
 * en maximisant le nombre de paires inédites (non présentes dans `seenPairs`).
 *
 * Stratégie : énumération exhaustive des partitions en paires (pratique jusqu'à ~12
 * joueurs, soit 10395 partitions pour 12 joueurs). On sélectionne la partition qui :
 *   1. minimise le nombre de paires déjà vues ;
 *   2. à égalité, minimise la somme des écarts d'Elo au sein des paires ;
 *   3. à égalité encore, ordre aléatoire.
 *
 * Les tournois réels dépassent rarement 8 joueurs = 4 paires ⇒ 105 partitions.
 */
export function buildBalancedPairs(
  players: PairingPlayer[],
  opts: BuildPairsOptions = {},
): Pair[] {
  if (players.length < 2) return [];
  if (players.length % 2 !== 0) {
    throw new Error("buildBalancedPairs : nombre de joueurs doit être pair");
  }
  const seen = opts.seenPairs ?? new Set<string>();
  const rng = opts.rng ?? Math.random;

  const partitions = enumeratePairs(players);

  let best: { pairs: Pair[]; repeats: number; eloSpread: number; tiebreak: number } | null = null;
  for (const partition of partitions) {
    let repeats = 0;
    let eloSpread = 0;
    for (const [a, b] of partition) {
      if (seen.has(pairKey(a.id, b.id))) repeats += 1;
      eloSpread += Math.abs((a.elo ?? 1000) - (b.elo ?? 1000));
    }
    const tiebreak = rng();
    if (
      !best ||
      repeats < best.repeats ||
      (repeats === best.repeats && eloSpread < best.eloSpread) ||
      (repeats === best.repeats && eloSpread === best.eloSpread && tiebreak < best.tiebreak)
    ) {
      best = { pairs: partition, repeats, eloSpread, tiebreak };
    }
  }
  return best ? best.pairs : [];
}

/**
 * Énumère toutes les partitions en paires d'une liste de joueurs (n pair).
 * Complexité O((n-1)!!) — n=8 → 105, n=10 → 945, n=12 → 10395, raisonnable à cette échelle.
 */
function enumeratePairs(players: PairingPlayer[]): Pair[][] {
  if (players.length === 0) return [[]];
  const [first, ...rest] = players;
  const results: Pair[][] = [];
  for (let i = 0; i < rest.length; i++) {
    const partner = rest[i];
    const remaining = rest.filter((_, j) => j !== i);
    for (const sub of enumeratePairs(remaining)) {
      results.push([[first, partner], ...sub]);
    }
  }
  return results;
}
