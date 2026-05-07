import { describe, expect, it } from "vitest";
import type { MatchRow } from "@/lib/db/types";
import { deltaForPlayer, deltaForSlot, slotForPlayer } from "./match-delta";

function teamMatch(opts: Partial<MatchRow> = {}): MatchRow {
  return {
    id: "m1",
    mode: "team",
    team_a_id: "tA",
    team_b_id: "tB",
    player_a1_id: "p1",
    player_a2_id: "p2",
    player_b1_id: "p3",
    player_b2_id: "p4",
    score_a: 10,
    score_b: 6,
    winner_side: "A",
    elo_delta_a: 20,
    elo_delta_b: -20,
    elo_delta_a1: 24,
    elo_delta_a2: 16,
    elo_delta_b1: -16,
    elo_delta_b2: -24,
    team_elo_delta_a: 18,
    team_elo_delta_b: -18,
    played_at: "2026-05-07T12:00:00.000Z",
    recorded_by: null,
    session_id: null,
    ...opts,
  };
}

describe("slotForPlayer", () => {
  it("identifie le slot d'un joueur", () => {
    const m = teamMatch();
    expect(slotForPlayer(m, "p1")).toBe("a1");
    expect(slotForPlayer(m, "p2")).toBe("a2");
    expect(slotForPlayer(m, "p3")).toBe("b1");
    expect(slotForPlayer(m, "p4")).toBe("b2");
  });

  it("renvoie null pour un joueur non impliqué", () => {
    expect(slotForPlayer(teamMatch(), "ghost")).toBeNull();
  });
});

describe("deltaForSlot", () => {
  it("renvoie le delta individuel quand stocké", () => {
    const m = teamMatch();
    expect(deltaForSlot(m, "a1")).toBe(24);
    expect(deltaForSlot(m, "a2")).toBe(16);
    expect(deltaForSlot(m, "b1")).toBe(-16);
    expect(deltaForSlot(m, "b2")).toBe(-24);
  });

  it("retombe sur la moyenne d'équipe pour les anciennes lignes (null)", () => {
    const m = teamMatch({
      elo_delta_a1: null,
      elo_delta_a2: null,
      elo_delta_b1: null,
      elo_delta_b2: null,
    });
    expect(deltaForSlot(m, "a1")).toBe(20);
    expect(deltaForSlot(m, "a2")).toBe(20);
    expect(deltaForSlot(m, "b1")).toBe(-20);
    expect(deltaForSlot(m, "b2")).toBe(-20);
  });
});

describe("deltaForPlayer", () => {
  it("renvoie le delta individuel du joueur en 2v2", () => {
    const m = teamMatch();
    // Porteur (a1) reçoit plus que la moyenne ; partenaire (a2) reçoit moins.
    expect(deltaForPlayer(m, "p1")).toBe(24);
    expect(deltaForPlayer(m, "p2")).toBe(16);
    expect(deltaForPlayer(m, "p3")).toBe(-16);
    expect(deltaForPlayer(m, "p4")).toBe(-24);
    // Conservation : la somme par équipe = 2 × moyenne.
    expect(deltaForPlayer(m, "p1") + deltaForPlayer(m, "p2")).toBe(2 * m.elo_delta_a);
    expect(deltaForPlayer(m, "p3") + deltaForPlayer(m, "p4")).toBe(2 * m.elo_delta_b);
  });

  it("renvoie 0 pour un joueur absent du match", () => {
    expect(deltaForPlayer(teamMatch(), "ghost")).toBe(0);
  });

  it("retombe sur la moyenne pour un match pré-0018", () => {
    const m = teamMatch({
      elo_delta_a1: null,
      elo_delta_a2: null,
      elo_delta_b1: null,
      elo_delta_b2: null,
    });
    expect(deltaForPlayer(m, "p1")).toBe(20);
    expect(deltaForPlayer(m, "p2")).toBe(20);
  });
});
