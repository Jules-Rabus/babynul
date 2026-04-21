import type { MatchRow } from "@/lib/supabase/types";

export type PlayerForm =
  | { kind: "goat"; streak: number }
  | { kind: "roast"; streak: number }
  | { kind: "neutral" };

export type FormOptions = {
  /** Si fourni, limite le calcul aux matchs de cette session. */
  sessionId?: string | null;
  /** Seuil minimum de matchs consécutifs pour déclencher un mode. Défaut: 3. */
  threshold?: number;
};

function didWin(m: MatchRow, playerId: string): boolean {
  const onA =
    m.player_a1_id === playerId || m.player_a2_id === playerId;
  return onA ? m.winner_side === "A" : m.winner_side === "B";
}

function involves(m: MatchRow, playerId: string): boolean {
  return (
    m.player_a1_id === playerId ||
    m.player_a2_id === playerId ||
    m.player_b1_id === playerId ||
    m.player_b2_id === playerId
  );
}

/**
 * Calcule la forme d'un joueur à partir de ses matchs récents.
 *
 * Convention d'entrée : `matches` peut être non filtré ; on garde uniquement
 * ceux qui impliquent `playerId` (et matchent `sessionId` si fourni).
 * L'ordre de tri est ensuite : played_at desc → on lit la série courante.
 */
export function computeForm(
  playerId: string,
  matches: MatchRow[],
  opts: FormOptions = {},
): PlayerForm {
  const threshold = opts.threshold ?? 3;
  const filtered = matches
    .filter((m) => involves(m, playerId))
    .filter((m) => (opts.sessionId ? m.session_id === opts.sessionId : true))
    .sort((a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime());

  if (filtered.length === 0) return { kind: "neutral" };

  const firstWon = didWin(filtered[0], playerId);
  let streak = 1;
  for (let i = 1; i < filtered.length; i++) {
    if (didWin(filtered[i], playerId) === firstWon) streak++;
    else break;
  }

  if (streak < threshold) return { kind: "neutral" };
  return firstWon ? { kind: "goat", streak } : { kind: "roast", streak };
}

/**
 * Calcule la forme pour un lot de joueurs en une passe (efficace).
 */
export function computeFormsFor(
  playerIds: string[],
  matches: MatchRow[],
  opts: FormOptions = {},
): Record<string, PlayerForm> {
  const out: Record<string, PlayerForm> = {};
  for (const id of playerIds) {
    out[id] = computeForm(id, matches, opts);
  }
  return out;
}
