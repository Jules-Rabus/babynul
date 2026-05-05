import { describe, expect, it } from "vitest";
import {
  expectedScore,
  eloDelta,
  eloDeltaWeighted,
  eloOdds,
  distributeTeamDelta,
} from "./elo";

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

    it("match serré (margin=1) : delta réduit vs marge=2 à Elo égal", () => {
      const close = Math.abs(eloDeltaWeighted(1000, 1000, 3, 2));
      const med = Math.abs(eloDeltaWeighted(1000, 1000, 3, 1));
      // Le close-match factor 0.7 doit faire chuter le ratio sous le simple ln(2)/ln(3)
      expect(close / med).toBeLessThan(Math.log(2) / Math.log(3));
    });

    it("match serré reste symétrique (gagnant +X, perdant -X)", () => {
      const a = eloDeltaWeighted(1000, 1000, 3, 2);
      const b = eloDeltaWeighted(1000, 1000, 2, 3);
      expect(a).toBe(-b);
    });
  });

  describe("distributeTeamDelta", () => {
    it("0 si deltaTeam = 0", () => {
      expect(distributeTeamDelta(0, 1400, 900)).toEqual([0, 0]);
    });

    it("Elo identiques : split égal et conservation", () => {
      const [d1, d2] = distributeTeamDelta(-16, 1100, 1100);
      expect(d1).toBe(-16);
      expect(d2).toBe(-16);
    });

    it("perte : le top encaisse moins, le faible plus, somme = 2×delta", () => {
      const deltaTeam = -16;
      const [dTop, dLow] = distributeTeamDelta(deltaTeam, 1400, 900);
      expect(Math.abs(dTop)).toBeLessThan(Math.abs(deltaTeam));
      expect(Math.abs(dLow)).toBeGreaterThan(Math.abs(deltaTeam));
      expect(dTop + dLow).toBe(2 * deltaTeam);
    });

    it("victoire : le top gagne plus, le faible moins, somme = 2×delta", () => {
      const deltaTeam = 16;
      const [dTop, dLow] = distributeTeamDelta(deltaTeam, 1400, 900);
      expect(dTop).toBeGreaterThan(deltaTeam);
      expect(dLow).toBeLessThan(deltaTeam);
      expect(dTop + dLow).toBe(2 * deltaTeam);
    });

    it("ordre des arguments : commute symétriquement", () => {
      const [a1, a2] = distributeTeamDelta(-16, 1400, 900);
      const [b1, b2] = distributeTeamDelta(-16, 900, 1400);
      expect(a1).toBe(b2);
      expect(a2).toBe(b1);
    });

    it("conservation préservée même avec écart énorme (clamp du spread)", () => {
      const deltaTeam = -20;
      const [d1, d2] = distributeTeamDelta(deltaTeam, 1800, 600);
      expect(d1 + d2).toBe(2 * deltaTeam);
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
