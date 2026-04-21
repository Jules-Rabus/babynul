import { describe, expect, it } from "vitest";
import { buildAnnouncePrompt, pickAudioStyle } from "./build-announce-prompt";

describe("buildAnnouncePrompt", () => {
  const neutralPlayer = (id: string, name: string) => ({
    id,
    name,
    form: { kind: "neutral" as const },
  });

  it("inclut les deux équipes avec leurs noms d'annonce (surnoms préférés)", () => {
    const prompt = buildAnnouncePrompt({
      teamA: [neutralPlayer("p1", "Le Boss"), neutralPlayer("p2", "La Machine")],
      teamB: [neutralPlayer("p3", "Sniper"), neutralPlayer("p4", "Zizou")],
    });
    expect(prompt).toContain("Le Boss et La Machine");
    expect(prompt).toContain("Sniper et Zizou");
  });

  it("injecte le mode GOAT pour les joueurs en série de victoires", () => {
    const prompt = buildAnnouncePrompt({
      teamA: [
        { id: "p1", name: "Le Goat", form: { kind: "goat", streak: 5 } },
      ],
      teamB: [neutralPlayer("p2", "Marc")],
    });
    expect(prompt).toContain("MODE GOAT");
    expect(prompt).toContain("Le Goat");
    expect(prompt).toContain("5");
    expect(prompt).toContain("épique");
  });

  it("injecte le mode ROAST pour les joueurs en série de défaites", () => {
    const prompt = buildAnnouncePrompt({
      teamA: [neutralPlayer("p1", "Max")],
      teamB: [{ id: "p2", name: "Inès", form: { kind: "roast", streak: 3 } }],
    });
    expect(prompt).toContain("MODE ROAST");
    expect(prompt).toContain("Inès");
    expect(prompt).toContain("3");
    expect(prompt).toContain("bon-enfant");
  });

  it("ajoute une narration épique quand goat + roast sont présents", () => {
    const prompt = buildAnnouncePrompt({
      teamA: [{ id: "p1", name: "Le Goat", form: { kind: "goat", streak: 4 } }],
      teamB: [{ id: "p2", name: "Max", form: { kind: "roast", streak: 3 } }],
    });
    expect(prompt).toContain("David vs Goliath");
  });

  it("reste simple si tout le monde est neutre", () => {
    const prompt = buildAnnouncePrompt({
      teamA: [neutralPlayer("p1", "A")],
      teamB: [neutralPlayer("p2", "B")],
    });
    expect(prompt).not.toContain("MODE GOAT");
    expect(prompt).not.toContain("MODE ROAST");
  });
});

describe("pickAudioStyle", () => {
  it("excited pour goat seul", () => {
    expect(
      pickAudioStyle({
        teamA: [{ id: "p1", name: "A", form: { kind: "goat", streak: 3 } }],
        teamB: [{ id: "p2", name: "B", form: { kind: "neutral" } }],
      }),
    ).toBe("excited");
  });

  it("teasing pour roast seul", () => {
    expect(
      pickAudioStyle({
        teamA: [{ id: "p1", name: "A", form: { kind: "roast", streak: 3 } }],
        teamB: [{ id: "p2", name: "B", form: { kind: "neutral" } }],
      }),
    ).toBe("teasing");
  });

  it("excited si goat + roast", () => {
    expect(
      pickAudioStyle({
        teamA: [{ id: "p1", name: "A", form: { kind: "goat", streak: 3 } }],
        teamB: [{ id: "p2", name: "B", form: { kind: "roast", streak: 3 } }],
      }),
    ).toBe("excited");
  });

  it("neutral par défaut", () => {
    expect(
      pickAudioStyle({
        teamA: [{ id: "p1", name: "A", form: { kind: "neutral" } }],
        teamB: [{ id: "p2", name: "B", form: { kind: "neutral" } }],
      }),
    ).toBe("neutral");
  });
});
