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
};

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
 * Génère une liste de matches équilibrés pour une journée.
 *
 * Principes :
 * 1. Priorité session : joueurs ayant le moins joué dans la session courante.
 * 2. Tie-breaker : games_played historique asc.
 * 3. Tie-breaker secondaire : elo desc (les forts jouent avec les nouveaux).
 * 4. Pour chaque vague de 4 joueurs, on forme 2 équipes en appariant fort+faible.
 * 5. Chaque joueur apparaît dans au moins un match proposé.
 * 6. On tronque à 2×N matchs (≈ 2 parties par joueur si possible).
 */
export function generateMatches(
  presentPlayers: MatchmakingPlayer[],
  opts?: GenerateMatchesOptions,
): ProposedMatch[] {
  if (presentPlayers.length < 4) return [];

  const sorted = [...presentPlayers].sort((a, b) => {
    const sa = resolveSessionCount(opts, a.id);
    const sb = resolveSessionCount(opts, b.id);
    if (sa !== sb) return sa - sb;
    if (a.games_played !== b.games_played) return a.games_played - b.games_played;
    return b.elo - a.elo;
  });

  const matches: ProposedMatch[] = [];
  const appearances = new Map<string, number>(sorted.map((p) => [p.id, 0]));
  const targetMatches = opts?.targetMatches ?? sorted.length;

  let matchIndex = 0;
  const maxIterations = targetMatches * 3;
  let iter = 0;

  while (matches.length < targetMatches && iter < maxIterations) {
    iter++;

    // Tri du pool : apparitions dans cette génération, puis session, puis historique, puis elo.
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

    // Apparier fort+faible : four[0] (fort) avec four[3] (faible), four[1] avec four[2]
    const byElo = [...four].sort((a, b) => b.elo - a.elo);
    const teamA = buildTeam(byElo[0], byElo[3]);
    const teamB = buildTeam(byElo[1], byElo[2]);

    const eloGap = Math.abs(pairElo(teamA) - pairElo(teamB));

    matches.push({
      id: `match-${matchIndex++}`,
      teamA,
      teamB,
      eloGap,
    });

    for (const p of four) {
      appearances.set(p.id, (appearances.get(p.id) ?? 0) + 1);
    }
  }

  return matches;
}
