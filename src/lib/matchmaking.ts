import type { PlayerRow } from "@/lib/supabase/types";

export type MatchmakingPlayer = Pick<PlayerRow, "id" | "first_name" | "last_name" | "elo" | "games_played">;

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
 * Génère une liste de matches équilibrés pour une journée.
 *
 * Principes :
 * 1. Priorité aux joueurs ayant le moins joué historiquement (games_played asc).
 * 2. Pour chaque vague de 4 joueurs, on forme 2 équipes en appariant fort+faible.
 * 3. Chaque joueur apparaît dans au moins un match proposé.
 * 4. On tronque à 2×N matchs (≈ 2 parties par joueur si possible).
 */
export function generateMatches(presentPlayers: MatchmakingPlayer[]): ProposedMatch[] {
  if (presentPlayers.length < 4) return [];

  const sorted = [...presentPlayers].sort((a, b) => {
    if (a.games_played !== b.games_played) return a.games_played - b.games_played;
    return b.elo - a.elo;
  });

  const matches: ProposedMatch[] = [];
  const appearances = new Map<string, number>(sorted.map((p) => [p.id, 0]));
  const targetMatches = sorted.length; // ~2 parties par joueur

  let matchIndex = 0;
  const maxIterations = targetMatches * 3;
  let iter = 0;

  while (matches.length < targetMatches && iter < maxIterations) {
    iter++;

    // Les 4 joueurs avec le moins d'apparitions dans cette session (puis par games_played asc)
    const pool = [...sorted].sort((a, b) => {
      const appDiff = (appearances.get(a.id) ?? 0) - (appearances.get(b.id) ?? 0);
      if (appDiff !== 0) return appDiff;
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
