import { describe, expect, it } from "vitest";
import { expectedScore, eloDelta, eloOdds } from "./elo";

describe("elo", () => {
  describe("expectedScore", () => {
    it("vaut 0.5 pour deux joueurs de même niveau", () => {
      expect(expectedScore(1000, 1000)).toBeCloseTo(0.5, 5);
    });

    it("est > 0.5 pour le plus fort", () => {
      expect(expectedScore(1400, 1000)).toBeGreaterThan(0.5);
    });

    it("est < 0.5 pour le plus faible", () => {
      expect(expectedScore(1000, 1400)).toBeLessThan(0.5);
    });

    it("somme symétrique des deux côtés = 1", () => {
      expect(expectedScore(1200, 1000) + expectedScore(1000, 1200)).toBeCloseTo(1, 5);
    });
  });

  describe("eloDelta", () => {
    it("delta symétrique : A gagne = -delta B", () => {
      const a = eloDelta(1000, 1000, 1);
      const b = eloDelta(1000, 1000, 0);
      expect(a).toBe(-b);
    });

    it("vainqueur même niveau = +K/2 (avec arrondi)", () => {
      const delta = eloDelta(1000, 1000, 1);
      expect(delta).toBe(16); // K=32, actual - expected = 1 - 0.5 = 0.5, * 32 = 16
    });

    it("gain faible pour favori qui gagne", () => {
      const favorite = eloDelta(1400, 1000, 1);
      const equal = eloDelta(1000, 1000, 1);
      expect(favorite).toBeLessThan(equal);
    });

    it("gros upset pour outsider qui gagne", () => {
      const upset = eloDelta(1000, 1400, 1);
      const equal = eloDelta(1000, 1000, 1);
      expect(upset).toBeGreaterThan(equal);
    });
  });

  describe("eloOdds", () => {
    it("cote > 1 pour favori (avec marge)", () => {
      expect(eloOdds(1400, 1000)).toBeGreaterThan(1);
    });

    it("cote plus forte pour outsider", () => {
      const fav = eloOdds(1400, 1000);
      const und = eloOdds(1000, 1400);
      expect(und).toBeGreaterThan(fav);
    });
  });
});
