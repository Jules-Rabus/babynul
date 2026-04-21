import type { PlayerRow } from "@/lib/supabase/types";

export type MatchmakingPlayer = Pick<PlayerRow, "id" | "first_name" | "nickname" | "elo" | "games_played">;

export type ProposedTeam = {
  players: [MatchmakingPlayer, MatchmakingPlayer];
  avgElo: number;
};

export type ProposedMatch = {
  id: string;
  teamA: ProposedTeam;
  teamB: ProposedTeam;
  eloGap: number;
};

function pairElo(t: ProposedTeam) {
  return t.avgElo;
}

function buildTeam(p1: MatchmakingPlayer, p2: MatchmakingPlayer): ProposedTeam {
  return {
    players: [p1, p2],
    avgElo: Math.round((p1.elo + p2.elo) / 2),
  };
}

/**
 * Coût (en points d'Elo équivalent) d'avoir déjà vu une paire dans le même tournoi.
 * Plus c'est haut, plus l'algo force la variété, au risque d'augmenter le gap d'Elo.
 */
export const PAIR_REPETITION_PENALTY = 40;

export type GenerateMatchesOptions = {
  /**
   * Nombre de matchs déjà joués par chaque joueur dans la session courante.
   * Quand fourni, les joueurs ayant le moins joué dans la session passent en priorité,
   * avec games_played historique en tie-breaker, puis elo desc.
   */
  sessionGamesPlayed?: Map<string, number> | Record<string, number>;
  /**
   * Nombre de matchs cible. Par défaut : nombre de joueurs (≈ 2 parties/joueur).
   */
  targetMatches?: number;
  /**
   * Pénalité pour reformer une paire déjà vue dans cette génération.
   * Default: PAIR_REPETITION_PENALTY.
   */
  pairRepetitionPenalty?: number;
};

function pairKey(a: MatchmakingPlayer, b: MatchmakingPlayer): string {
  return a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
}

type Candidate = {
  teamA: ProposedTeam;
  teamB: ProposedTeam;
  eloGap: number;
  pairPenalty: number;
};

function enumerateCandidates(four: MatchmakingPlayer[]): Candidate[] {
  const [p0, p1, p2, p3] = four;
  const combos: Array<[MatchmakingPlayer, MatchmakingPlayer, MatchmakingPlayer, MatchmakingPlayer]> = [
    [p0, p1, p2, p3], // (p0,p1) vs (p2,p3)
    [p0, p2, p1, p3], // (p0,p2) vs (p1,p3)
    [p0, p3, p1, p2], // (p0,p3) vs (p1,p2)
  ];
  return combos.map(([a1, a2, b1, b2]) => {
    const teamA = buildTeam(a1, a2);
    const teamB = buildTeam(b1, b2);
    return {
      teamA,
      teamB,
      eloGap: Math.abs(pairElo(teamA) - pairElo(teamB)),
      pairPenalty: 0, // rempli plus tard avec pairCounts courant
    };
  });
}

function resolveSessionCount(
  opts: GenerateMatchesOptions | undefined,
  playerId: string,
): number {
  if (!opts?.sessionGamesPlayed) return 0;
  if (opts.sessionGamesPlayed instanceof Map) {
    return opts.sessionGamesPlayed.get(playerId) ?? 0;
  }
  return opts.sessionGamesPlayed[playerId] ?? 0;
}

/**
 * Génère une liste de matchs équilibrés pour un tournoi.
 *
 * Sélection des 4 joueurs (dans l'ordre) :
 * 1. Apparitions dans cette génération (asc) — équilibrer le nombre de matchs par joueur.
 * 2. Matchs joués dans la session courante (asc) — équité du tournoi.
 * 3. games_played historique (asc) — tie-breaker long terme.
 * 4. Elo desc.
 *
 * Appariement des 4 joueurs choisis :
 * - Énumérer les 3 appariements possibles.
 * - Score = eloGap + PAIR_REPETITION_PENALTY × pairPenalty.
 * - Garder le plus petit score → variété dynamique sans gap explosif.
 */
export function generateMatches(
  presentPlayers: MatchmakingPlayer[],
  opts?: GenerateMatchesOptions,
): ProposedMatch[] {
  if (presentPlayers.length < 4) return [];

  const penalty = opts?.pairRepetitionPenalty ?? PAIR_REPETITION_PENALTY;

  const sorted = [...presentPlayers].sort((a, b) => {
    const sa = resolveSessionCount(opts, a.id);
    const sb = resolveSessionCount(opts, b.id);
    if (sa !== sb) return sa - sb;
    if (a.games_played !== b.games_played) return a.games_played - b.games_played;
    return b.elo - a.elo;
  });

  const matches: ProposedMatch[] = [];
  const appearances = new Map<string, number>(sorted.map((p) => [p.id, 0]));
  const pairCounts = new Map<string, number>();
  const targetMatches = opts?.targetMatches ?? sorted.length;

  let matchIndex = 0;
  const maxIterations = targetMatches * 3;
  let iter = 0;

  while (matches.length < targetMatches && iter < maxIterations) {
    iter++;

    const pool = [...sorted].sort((a, b) => {
      const appDiff = (appearances.get(a.id) ?? 0) - (appearances.get(b.id) ?? 0);
      if (appDiff !== 0) return appDiff;
      const sa = resolveSessionCount(opts, a.id);
      const sb = resolveSessionCount(opts, b.id);
      if (sa !== sb) return sa - sb;
      if (a.games_played !== b.games_played) return a.games_played - b.games_played;
      return b.elo - a.elo;
    });

    const four = pool.slice(0, 4);
    if (four.length < 4) break;

    const candidates = enumerateCandidates(four);
    // Score chaque candidat avec les pairCounts à jour.
    for (const c of candidates) {
      const pA = pairCounts.get(pairKey(c.teamA.players[0], c.teamA.players[1])) ?? 0;
      const pB = pairCounts.get(pairKey(c.teamB.players[0], c.teamB.players[1])) ?? 0;
      c.pairPenalty = pA + pB;
    }
    const best = candidates.reduce((a, b) => {
      const scoreA = a.eloGap + penalty * a.pairPenalty;
      const scoreB = b.eloGap + penalty * b.pairPenalty;
      return scoreB < scoreA ? b : a;
    });

    matches.push({
      id: `match-${matchIndex++}`,
      teamA: best.teamA,
      teamB: best.teamB,
      eloGap: best.eloGap,
    });

    for (const p of four) {
      appearances.set(p.id, (appearances.get(p.id) ?? 0) + 1);
    }
    const kA = pairKey(best.teamA.players[0], best.teamA.players[1]);
    const kB = pairKey(best.teamB.players[0], best.teamB.players[1]);
    pairCounts.set(kA, (pairCounts.get(kA) ?? 0) + 1);
    pairCounts.set(kB, (pairCounts.get(kB) ?? 0) + 1);
  }

  return matches;
}
