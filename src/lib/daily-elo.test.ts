import { describe, it, expect } from "vitest";
import {
  aggregatePlayersForDay,
  aggregateTeamsForDay,
  dayKey,
  filterMatchesByDay,
  listMatchDays,
} from "./daily-elo";
import type { MatchRow } from "@/lib/db/types";

function isoLocal(y: number, mo: number, d: number, h = 12) {
  const dt = new Date(y, mo - 1, d, h, 0, 0, 0);
  return dt.toISOString();
}

function indiv(opts: Partial<MatchRow> & {
  played_at: string;
  a1: string;
  b1: string;
  winner_side: "A" | "B";
  delta_a: number;
  delta_b: number;
}): MatchRow {
  return {
    id: opts.id ?? crypto.randomUUID(),
    mode: "individual",
    team_a_id: null,
    team_b_id: null,
    player_a1_id: opts.a1,
    player_a2_id: null,
    player_b1_id: opts.b1,
    player_b2_id: null,
    score_a: 0,
    score_b: 0,
    winner_side: opts.winner_side,
    elo_delta_a: opts.delta_a,
    elo_delta_b: opts.delta_b,
    team_elo_delta_a: null,
    team_elo_delta_b: null,
    played_at: opts.played_at,
    recorded_by: null,
    session_id: null,
  };
}

function team(opts: {
  played_at: string;
  a1: string; a2: string; b1: string; b2: string;
  team_a: string; team_b: string;
  winner_side: "A" | "B";
  delta_a: number; delta_b: number;
  team_delta_a: number; team_delta_b: number;
}): MatchRow {
  return {
    id: crypto.randomUUID(),
    mode: "team",
    team_a_id: opts.team_a,
    team_b_id: opts.team_b,
    player_a1_id: opts.a1,
    player_a2_id: opts.a2,
    player_b1_id: opts.b1,
    player_b2_id: opts.b2,
    score_a: 0,
    score_b: 0,
    winner_side: opts.winner_side,
    elo_delta_a: opts.delta_a,
    elo_delta_b: opts.delta_b,
    team_elo_delta_a: opts.team_delta_a,
    team_elo_delta_b: opts.team_delta_b,
    played_at: opts.played_at,
    recorded_by: null,
    session_id: null,
  };
}

describe("dayKey", () => {
  it("retourne la date locale au format YYYY-MM-DD", () => {
    expect(dayKey(isoLocal(2025, 3, 7, 14))).toBe("2025-03-07");
  });
});

describe("listMatchDays", () => {
  it("renvoie les jours distincts triés du plus récent au plus ancien", () => {
    const matches = [
      indiv({ played_at: isoLocal(2025, 3, 5), a1: "p1", b1: "p2", winner_side: "A", delta_a: 10, delta_b: -10 }),
      indiv({ played_at: isoLocal(2025, 3, 7), a1: "p1", b1: "p2", winner_side: "A", delta_a: 8, delta_b: -8 }),
      indiv({ played_at: isoLocal(2025, 3, 6), a1: "p1", b1: "p2", winner_side: "B", delta_a: -5, delta_b: 5 }),
      indiv({ played_at: isoLocal(2025, 3, 7, 9), a1: "p3", b1: "p4", winner_side: "B", delta_a: -7, delta_b: 7 }),
    ];
    expect(listMatchDays(matches)).toEqual(["2025-03-07", "2025-03-06", "2025-03-05"]);
  });

  it("renvoie un tableau vide si aucun match", () => {
    expect(listMatchDays([])).toEqual([]);
  });
});

describe("filterMatchesByDay", () => {
  it("ne garde que les matches de la journée demandée", () => {
    const m1 = indiv({ played_at: isoLocal(2025, 3, 5), a1: "p1", b1: "p2", winner_side: "A", delta_a: 1, delta_b: -1 });
    const m2 = indiv({ played_at: isoLocal(2025, 3, 6), a1: "p1", b1: "p2", winner_side: "A", delta_a: 1, delta_b: -1 });
    expect(filterMatchesByDay([m1, m2], "2025-03-05")).toEqual([m1]);
  });
});

describe("aggregatePlayersForDay", () => {
  it("somme Δ Elo et compte V/D pour 1v1", () => {
    const day = "2025-03-07";
    const matches = [
      indiv({ played_at: isoLocal(2025, 3, 7, 9), a1: "p1", b1: "p2", winner_side: "A", delta_a: 12, delta_b: -12 }),
      indiv({ played_at: isoLocal(2025, 3, 7, 10), a1: "p1", b1: "p3", winner_side: "B", delta_a: -8, delta_b: 8 }),
      indiv({ played_at: isoLocal(2025, 3, 6, 10), a1: "p1", b1: "p2", winner_side: "A", delta_a: 99, delta_b: -99 }), // autre jour
    ];
    const stats = aggregatePlayersForDay(matches, day);
    expect(stats.get("p1")).toEqual({ playerId: "p1", games: 2, wins: 1, losses: 1, eloDelta: 4 });
    expect(stats.get("p2")).toEqual({ playerId: "p2", games: 1, wins: 0, losses: 1, eloDelta: -12 });
    expect(stats.get("p3")).toEqual({ playerId: "p3", games: 1, wins: 1, losses: 0, eloDelta: 8 });
  });

  it("compte les 4 joueurs en mode équipe", () => {
    const day = "2025-03-07";
    const matches = [
      team({
        played_at: isoLocal(2025, 3, 7),
        a1: "p1", a2: "p2", b1: "p3", b2: "p4",
        team_a: "tA", team_b: "tB",
        winner_side: "A", delta_a: 10, delta_b: -10,
        team_delta_a: 11, team_delta_b: -11,
      }),
    ];
    const stats = aggregatePlayersForDay(matches, day);
    expect(stats.get("p1")?.eloDelta).toBe(10);
    expect(stats.get("p2")?.eloDelta).toBe(10);
    expect(stats.get("p3")?.eloDelta).toBe(-10);
    expect(stats.get("p4")?.eloDelta).toBe(-10);
    expect(stats.get("p1")?.wins).toBe(1);
    expect(stats.get("p3")?.losses).toBe(1);
  });
});

describe("aggregateTeamsForDay", () => {
  it("somme Δ Elo équipe et V/D, ignore les matches 1v1", () => {
    const day = "2025-03-07";
    const matches = [
      team({
        played_at: isoLocal(2025, 3, 7, 9),
        a1: "p1", a2: "p2", b1: "p3", b2: "p4",
        team_a: "tA", team_b: "tB",
        winner_side: "A", delta_a: 10, delta_b: -10,
        team_delta_a: 12, team_delta_b: -12,
      }),
      team({
        played_at: isoLocal(2025, 3, 7, 11),
        a1: "p1", a2: "p2", b1: "p5", b2: "p6",
        team_a: "tA", team_b: "tC",
        winner_side: "B", delta_a: -7, delta_b: 7,
        team_delta_a: -9, team_delta_b: 9,
      }),
      indiv({ played_at: isoLocal(2025, 3, 7), a1: "p1", b1: "p2", winner_side: "A", delta_a: 5, delta_b: -5 }),
    ];
    const stats = aggregateTeamsForDay(matches, day);
    expect(stats.get("tA")).toEqual({ teamId: "tA", games: 2, wins: 1, losses: 1, eloDelta: 3 });
    expect(stats.get("tB")).toEqual({ teamId: "tB", games: 1, wins: 0, losses: 1, eloDelta: -12 });
    expect(stats.get("tC")).toEqual({ teamId: "tC", games: 1, wins: 1, losses: 0, eloDelta: 9 });
  });

  it("ignore un match team sans team_elo_delta", () => {
    const day = "2025-03-07";
    const matches: MatchRow[] = [
      {
        id: "x",
        mode: "team",
        team_a_id: "tA",
        team_b_id: "tB",
        player_a1_id: "p1", player_a2_id: "p2",
        player_b1_id: "p3", player_b2_id: "p4",
        score_a: 0, score_b: 0,
        winner_side: "A",
        elo_delta_a: 0, elo_delta_b: 0,
        team_elo_delta_a: null, team_elo_delta_b: null,
        played_at: isoLocal(2025, 3, 7),
        recorded_by: null, session_id: null,
      },
    ];
    const stats = aggregateTeamsForDay(matches, day);
    expect(stats.size).toBe(0);
  });
});
