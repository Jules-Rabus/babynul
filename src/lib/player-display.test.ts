import { describe, expect, it } from "vitest";
import { displayName, announceName } from "./player-display";

describe("player-display", () => {
  describe("displayName", () => {
    it("renvoie 'Prénom (Surnom)' quand le surnom est défini", () => {
      expect(displayName({ first_name: "Jules", nickname: "Le Boss" })).toBe("Jules (Le Boss)");
    });

    it("renvoie le prénom seul quand il n'y a pas de surnom", () => {
      expect(displayName({ first_name: "Jules", nickname: null })).toBe("Jules");
      expect(displayName({ first_name: "Jules" })).toBe("Jules");
      expect(displayName({ first_name: "Jules", nickname: "" })).toBe("Jules");
    });

    it("trim les surnoms avec whitespace uniquement", () => {
      expect(displayName({ first_name: "Jules", nickname: "   " })).toBe("Jules");
    });
  });

  describe("announceName", () => {
    it("préfère le surnom pour les annonces vocales", () => {
      expect(announceName({ first_name: "Jules", nickname: "Le Goat" })).toBe("Le Goat");
    });

    it("fallback sur le prénom sans surnom", () => {
      expect(announceName({ first_name: "Jules", nickname: null })).toBe("Jules");
    });
  });
});
