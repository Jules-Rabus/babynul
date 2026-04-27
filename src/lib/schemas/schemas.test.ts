import { describe, it, expect } from "vitest";
import { RecordMatchSchema, StartSessionSchema } from "./index";

const UUID = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

describe("RecordMatchSchema", () => {
  it("accepte un match 1v1 valide sans targetScore", () => {
    expect(
      RecordMatchSchema.safeParse({
        mode: "individual",
        a1: UUID,
        a2: null,
        b1: OTHER,
        b2: null,
        scoreA: 10,
        scoreB: 3,
      }).success,
    ).toBe(true);
  });

  it("refuse un match nul", () => {
    const res = RecordMatchSchema.safeParse({
      mode: "individual",
      a1: UUID,
      a2: null,
      b1: OTHER,
      b2: null,
      scoreA: 5,
      scoreB: 5,
    });
    expect(res.success).toBe(false);
  });

  it("refuse un match où le vainqueur n'atteint pas la cible", () => {
    const res = RecordMatchSchema.safeParse({
      mode: "individual",
      a1: UUID,
      a2: null,
      b1: OTHER,
      b2: null,
      scoreA: 4,
      scoreB: 2,
      targetScore: 5,
    });
    expect(res.success).toBe(false);
  });

  it("accepte un match où le vainqueur atteint exactement la cible", () => {
    expect(
      RecordMatchSchema.safeParse({
        mode: "individual",
        a1: UUID,
        a2: null,
        b1: OTHER,
        b2: null,
        scoreA: 3,
        scoreB: 1,
        targetScore: 3,
      }).success,
    ).toBe(true);
  });

  it("refuse les joueurs dupliqués en mode équipe", () => {
    const res = RecordMatchSchema.safeParse({
      mode: "team",
      a1: UUID,
      a2: OTHER,
      b1: UUID,
      b2: "33333333-3333-3333-3333-333333333333",
      scoreA: 10,
      scoreB: 2,
    });
    expect(res.success).toBe(false);
  });
});

describe("StartSessionSchema", () => {
  it("accepte un payload vide", () => {
    expect(StartSessionSchema.safeParse({}).success).toBe(true);
  });

  it("accepte un targetScore valide", () => {
    expect(
      StartSessionSchema.safeParse({ targetScore: 3 }).success,
    ).toBe(true);
  });

  it("refuse un targetScore hors bornes", () => {
    expect(StartSessionSchema.safeParse({ targetScore: 0 }).success).toBe(false);
    expect(StartSessionSchema.safeParse({ targetScore: 99 }).success).toBe(false);
  });
});
