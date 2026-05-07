import type { MatchRow } from "@/lib/db/types";
import { deltaForSlot, type MatchSlot } from "@/lib/match-delta";

export type DailyPlayerStat = {
  playerId: string;
  games: number;
  wins: number;
  losses: number;
  eloDelta: number;
};

export type DailyTeamStat = {
  teamId: string;
  games: number;
  wins: number;
  losses: number;
  eloDelta: number;
};

export function dayKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function listMatchDays(matches: MatchRow[]): string[] {
  const set = new Set<string>();
  for (const m of matches) set.add(dayKey(m.played_at));
  return Array.from(set).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
}

export function filterMatchesByDay(matches: MatchRow[], day: string): MatchRow[] {
  return matches.filter((m) => dayKey(m.played_at) === day);
}

export function aggregatePlayersForDay(
  matches: MatchRow[],
  day: string,
): Map<string, DailyPlayerStat> {
  const result = new Map<string, DailyPlayerStat>();
  const bump = (id: string | null, slot: MatchSlot, m: MatchRow) => {
    if (!id) return;
    const side: "A" | "B" = slot.startsWith("a") ? "A" : "B";
    const cur = result.get(id) ?? {
      playerId: id,
      games: 0,
      wins: 0,
      losses: 0,
      eloDelta: 0,
    };
    cur.games += 1;
    cur.eloDelta += deltaForSlot(m, slot);
    if (m.winner_side === side) cur.wins += 1;
    else cur.losses += 1;
    result.set(id, cur);
  };

  for (const m of matches) {
    if (dayKey(m.played_at) !== day) continue;
    bump(m.player_a1_id, "a1", m);
    if (m.mode === "team") bump(m.player_a2_id, "a2", m);
    bump(m.player_b1_id, "b1", m);
    if (m.mode === "team") bump(m.player_b2_id, "b2", m);
  }
  return result;
}

export function aggregateTeamsForDay(
  matches: MatchRow[],
  day: string,
): Map<string, DailyTeamStat> {
  const result = new Map<string, DailyTeamStat>();
  const bump = (id: string | null, side: "A" | "B", delta: number | null, m: MatchRow) => {
    if (!id || delta === null) return;
    const cur = result.get(id) ?? {
      teamId: id,
      games: 0,
      wins: 0,
      losses: 0,
      eloDelta: 0,
    };
    cur.games += 1;
    cur.eloDelta += delta;
    if (m.winner_side === side) cur.wins += 1;
    else cur.losses += 1;
    result.set(id, cur);
  };

  for (const m of matches) {
    if (m.mode !== "team") continue;
    if (dayKey(m.played_at) !== day) continue;
    bump(m.team_a_id, "A", m.team_elo_delta_a, m);
    bump(m.team_b_id, "B", m.team_elo_delta_b, m);
  }
  return result;
}
