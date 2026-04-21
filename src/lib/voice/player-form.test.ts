import { describe, expect, it } from "vitest";
import { computeForm } from "./player-form";
import type { MatchRow } from "@/lib/supabase/types";

function match(
  id: string,
  playedAgo: number,
  overrides: Partial<MatchRow> = {},
): MatchRow {
  return {
    id,
    mode: "individual",
    team_a_id: null,
    team_b_id: null,
    player_a1_id: null,
    player_a2_id: null,
    player_b1_id: null,
    player_b2_id: null,
    score_a: 10,
    score_b: 5,
    winner_side: "A",
    elo_delta_a: 10,
    elo_delta_b: -10,
    team_elo_delta_a: null,
    team_elo_delta_b: null,
    played_at: new Date(Date.now() - playedAgo * 60000).toISOString(),
    recorded_by: null,
    session_id: null,
    ...overrides,
  };
}

describe("computeForm", () => {
  it("retourne neutral sans matchs", () => {
    expect(computeForm("p1", [])).toEqual({ kind: "neutral" });
  });

  it("détecte GOAT à 3 victoires consécutives", () => {
    const matches = [
      match("m1", 1, { player_a1_id: "p1", winner_side: "A" }),
      match("m2", 2, { player_a1_id: "p1", winner_side: "A" }),
      match("m3", 3, { player_a1_id: "p1", winner_side: "A" }),
    ];
    expect(computeForm("p1", matches)).toEqual({ kind: "goat", streak: 3 });
  });

  it("détecte Roast à 3 défaites consécutives", () => {
    const matches = [
      match("m1", 1, { player_a1_id: "p1", winner_side: "B" }),
      match("m2", 2, { player_a1_id: "p1", winner_side: "B" }),
      match("m3", 3, { player_a1_id: "p1", winner_side: "B" }),
    ];
    expect(computeForm("p1", matches)).toEqual({ kind: "roast", streak: 3 });
  });

  it("reste neutral à 2 victoires (sous le seuil 3)", () => {
    const matches = [
      match("m1", 1, { player_a1_id: "p1", winner_side: "A" }),
      match("m2", 2, { player_a1_id: "p1", winner_side: "A" }),
      match("m3", 3, { player_a1_id: "p1", winner_side: "B" }),
    ];
    expect(computeForm("p1", matches)).toEqual({ kind: "neutral" });
  });

  it("respecte le seuil personnalisé", () => {
    const matches = [
      match("m1", 1, { player_a1_id: "p1", winner_side: "A" }),
      match("m2", 2, { player_a1_id: "p1", winner_side: "A" }),
    ];
    expect(computeForm("p1", matches, { threshold: 2 })).toEqual({ kind: "goat", streak: 2 });
  });

  it("filtre par session quand sessionId est fourni", () => {
    const matches = [
      match("m1", 1, { player_a1_id: "p1", winner_side: "B", session_id: "s1" }),
      match("m2", 2, { player_a1_id: "p1", winner_side: "B", session_id: "s1" }),
      match("m3", 3, { player_a1_id: "p1", winner_side: "B", session_id: "s1" }),
      match("m4", 4, { player_a1_id: "p1", winner_side: "A", session_id: "other" }),
    ];
    expect(computeForm("p1", matches, { sessionId: "s1" })).toEqual({ kind: "roast", streak: 3 });
  });

  it("la série s'arrête au premier match de résultat différent", () => {
    const matches = [
      match("m1", 1, { player_a1_id: "p1", winner_side: "A" }),
      match("m2", 2, { player_a1_id: "p1", winner_side: "A" }),
      match("m3", 3, { player_a1_id: "p1", winner_side: "A" }),
      match("m4", 4, { player_a1_id: "p1", winner_side: "B" }),
      match("m5", 5, { player_a1_id: "p1", winner_side: "A" }),
    ];
    // Les 3 plus récents sont des victoires
    expect(computeForm("p1", matches)).toEqual({ kind: "goat", streak: 3 });
  });

  it("détecte la victoire quand le joueur est côté B", () => {
    const matches = [
      match("m1", 1, { player_b1_id: "p1", winner_side: "B" }),
      match("m2", 2, { player_b1_id: "p1", winner_side: "B" }),
      match("m3", 3, { player_b1_id: "p1", winner_side: "B" }),
    ];
    expect(computeForm("p1", matches)).toEqual({ kind: "goat", streak: 3 });
  });

  it("ignore les matchs sans le joueur", () => {
    const matches = [
      match("m1", 1, { player_a1_id: "p1", winner_side: "A" }),
      match("m2", 2, { player_a1_id: "other", winner_side: "A" }),
      match("m3", 3, { player_a1_id: "p1", winner_side: "A" }),
      match("m4", 4, { player_a1_id: "p1", winner_side: "A" }),
    ];
    expect(computeForm("p1", matches)).toEqual({ kind: "goat", streak: 3 });
  });
});
