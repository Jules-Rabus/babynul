import { describe, expect, it } from "vitest";
import { expectedScore, eloDelta, eloDeltaWeighted, eloOdds } from "./elo";

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

  describe("eloDeltaWeighted", () => {
    it("renvoie 0 pour un match nul (pas supporté)", () => {
      expect(eloDeltaWeighted(1000, 1000, 3, 3)).toBe(0);
    });

    it("symétrique : delta A = -delta B", () => {
      const a = eloDeltaWeighted(1000, 1000, 10, 3);
      const b = eloDeltaWeighted(1000, 1000, 3, 10);
      expect(a).toBe(-b);
    });

    it("plus grand écart de buts → delta plus grand", () => {
      const d3to0 = eloDeltaWeighted(1000, 1000, 3, 0);
      const d3to2 = eloDeltaWeighted(1000, 1000, 3, 2);
      expect(Math.abs(d3to0)).toBeGreaterThan(Math.abs(d3to2));
    });

    it("favori qui gagne à marge modérée : gain inférieur à égalité ELO", () => {
      const fav = eloDeltaWeighted(1400, 1000, 5, 3);
      const equal = eloDeltaWeighted(1000, 1000, 5, 3);
      expect(fav).toBeLessThan(equal);
    });

    it("outsider qui gagne : delta > gagnant égal", () => {
      const upset = eloDeltaWeighted(1000, 1400, 5, 3);
      const equal = eloDeltaWeighted(1000, 1000, 5, 3);
      expect(upset).toBeGreaterThan(equal);
    });

    it("ne dépend que de la marge, pas des scores absolus", () => {
      const a = eloDeltaWeighted(1000, 1000, 3, 0);
      const b = eloDeltaWeighted(1000, 1000, 10, 7);
      expect(a).toBe(b);
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
