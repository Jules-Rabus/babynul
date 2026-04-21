import { describe, expect, it } from "vitest";
import { generateMatches, type MatchmakingPlayer } from "./matchmaking";

function player(
  id: string,
  elo: number,
  games_played = 0,
): MatchmakingPlayer {
  return { id, first_name: id, nickname: null, elo, games_played };
}

describe("generateMatches", () => {
  it("retourne vide si moins de 4 joueurs", () => {
    expect(generateMatches([])).toEqual([]);
    expect(generateMatches([player("a", 1000)])).toEqual([]);
    expect(generateMatches([player("a", 1000), player("b", 1000), player("c", 1000)])).toEqual([]);
  });

  it("appairage fort+faible : le plus fort joue avec le plus faible", () => {
    const players = [
      player("a", 1400),
      player("b", 1200),
      player("c", 1100),
      player("d", 900),
    ];
    const [match] = generateMatches(players, { targetMatches: 1 });
    const teamA = match.teamA.players.map((p) => p.id).sort();
    const teamB = match.teamB.players.map((p) => p.id).sort();
    // 1400 + 900 = 2300, 1200 + 1100 = 2300 → Elo moyen identique
    expect(teamA).toContain("a");
    expect(teamA).toContain("d");
    expect(teamB).toContain("b");
    expect(teamB).toContain("c");
  });

  it("équité session : priorité aux joueurs qui ont le moins joué en session", () => {
    const players = [
      player("a", 1000, 100),
      player("b", 1000, 100),
      player("c", 1000, 100),
      player("d", 1000, 100),
      player("newbie", 1000, 0),
    ];
    // newbie a 0 matchs historique, et pas de session count
    // Mais a, b, c, d ont déjà 2 matchs dans la session ; newbie 0.
    const sessionGamesPlayed = new Map([
      ["a", 2],
      ["b", 2],
      ["c", 2],
      ["d", 2],
      ["newbie", 0],
    ]);
    const [match] = generateMatches(players, { sessionGamesPlayed, targetMatches: 1 });
    const allIds = [...match.teamA.players, ...match.teamB.players].map((p) => p.id);
    expect(allIds).toContain("newbie");
  });

  it("équité historique utilisée en tie-breaker quand pas de session", () => {
    const players = [
      player("veteran", 1000, 500),
      player("medium", 1000, 50),
      player("newbie", 1000, 2),
      player("rookie", 1000, 1),
      player("extra", 1000, 100),
    ];
    const [match] = generateMatches(players, { targetMatches: 1 });
    // Les 4 avec le moins d'historique doivent être pris en priorité
    const ids = [...match.teamA.players, ...match.teamB.players].map((p) => p.id);
    expect(ids).toContain("rookie");
    expect(ids).toContain("newbie");
    expect(ids).not.toContain("veteran");
  });

  it("génère le nombre de matchs cible", () => {
    const players = [
      player("a", 1200),
      player("b", 1100),
      player("c", 1000),
      player("d", 900),
      player("e", 1050),
      player("f", 950),
    ];
    const matches = generateMatches(players, { targetMatches: 3 });
    expect(matches.length).toBe(3);
  });

  it("chaque match contient 4 joueurs distincts", () => {
    const players = Array.from({ length: 8 }, (_, i) => player(`p${i}`, 1000 + i * 10));
    const matches = generateMatches(players);
    for (const m of matches) {
      const ids = new Set([
        ...m.teamA.players.map((p) => p.id),
        ...m.teamB.players.map((p) => p.id),
      ]);
      expect(ids.size).toBe(4);
    }
  });
});
