import type { PlayerRow } from "@/lib/supabase/types";

export type TournamentPlayer = Pick<PlayerRow, "id" | "first_name" | "elo">;

export type TournamentMatch = {
  id: string;
  round: number;
  slot: number;
  p1: TournamentPlayer | null;
  p2: TournamentPlayer | null;
  winner: TournamentPlayer | null;
};

export type Tournament = {
  size: number;
  rounds: number;
  matches: TournamentMatch[];
};

const roundLabels: Record<number, string> = {
  1: "Finale",
  2: "Demi-finales",
  3: "Quarts de finale",
  4: "Huitièmes",
  5: "Seizièmes",
};

// Taille du bracket = puissance de 2 >= nombre de joueurs
function bracketSize(n: number): number {
  let s = 1;
  while (s < n) s *= 2;
  return Math.max(2, s);
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Crée un bracket à élimination directe.
 * Si le nombre de joueurs n'est pas une puissance de 2, on complète avec des byes (null)
 * qui font passer automatiquement leur adversaire au tour suivant.
 */
export function createTournament(players: TournamentPlayer[]): Tournament {
  const size = bracketSize(players.length);
  const rounds = Math.log2(size);
  const seeded = shuffle(players);
  // Padding avec des byes (null) pour atteindre la taille du bracket
  while (seeded.length < size) seeded.push(null as unknown as TournamentPlayer);

  const matches: TournamentMatch[] = [];
  // Premier tour : appariement séquentiel après shuffle
  const firstRoundMatches = size / 2;
  for (let slot = 0; slot < firstRoundMatches; slot++) {
    const p1 = seeded[slot * 2] ?? null;
    const p2 = seeded[slot * 2 + 1] ?? null;
    matches.push({
      id: `r${rounds}-m${slot}`,
      round: rounds,
      slot,
      p1,
      p2,
      // Auto-avance si un seul joueur est présent (bye)
      winner: p1 && !p2 ? p1 : !p1 && p2 ? p2 : null,
    });
  }
  // Tours suivants : placeholders
  for (let r = rounds - 1; r >= 1; r--) {
    const count = Math.pow(2, r - 1);
    for (let slot = 0; slot < count; slot++) {
      matches.push({
        id: `r${r}-m${slot}`,
        round: r,
        slot,
        p1: null,
        p2: null,
        winner: null,
      });
    }
  }

  // Propager les auto-byes au tour suivant
  const tournament: Tournament = { size, rounds, matches };
  propagateAutoByes(tournament);
  return tournament;
}

function propagateAutoByes(t: Tournament) {
  for (let r = t.rounds; r >= 2; r--) {
    const currentRound = t.matches.filter((m) => m.round === r);
    for (const m of currentRound) {
      if (!m.winner) continue;
      const nextMatch = t.matches.find((x) => x.round === r - 1 && x.slot === Math.floor(m.slot / 2));
      if (!nextMatch) continue;
      if (m.slot % 2 === 0) nextMatch.p1 = m.winner;
      else nextMatch.p2 = m.winner;
    }
  }
}

export function setWinner(t: Tournament, matchId: string, winnerId: string | null): Tournament {
  const matches = t.matches.map((m) => ({ ...m }));
  const match = matches.find((m) => m.id === matchId);
  if (!match) return t;
  const winner = winnerId === match.p1?.id ? match.p1 : winnerId === match.p2?.id ? match.p2 : null;
  match.winner = winner;

  // Nettoyer les tours suivants (si on change un résultat, les tours d'après sont peut-être obsolètes)
  for (let r = match.round - 1; r >= 1; r--) {
    for (const m of matches.filter((x) => x.round === r)) {
      m.p1 = null;
      m.p2 = null;
      m.winner = null;
    }
  }

  const nextTournament: Tournament = { ...t, matches };
  propagateAutoByes(nextTournament);
  return nextTournament;
}

export function getChampion(t: Tournament): TournamentPlayer | null {
  return t.matches.find((m) => m.round === 1)?.winner ?? null;
}

export function roundLabel(round: number): string {
  return roundLabels[round] ?? `Tour ${round}`;
}
