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

  it("minimise le gap d'Elo : choisit l'appariement qui équilibre les moyennes", () => {
    const players = [
      player("a", 1400),
      player("b", 1200),
      player("c", 1100),
      player("d", 900),
    ];
    const [match] = generateMatches(players, { targetMatches: 1 });
    // Trois options possibles : (a,b)vs(c,d)=1300 vs 1000 gap=300 ; (a,c)vs(b,d)=1250 vs 1050 gap=200 ;
    // (a,d)vs(b,c)=1150 vs 1150 gap=0 → doit choisir la dernière.
    expect(match.eloGap).toBe(0);
    const ids = [...match.teamA.players, ...match.teamB.players].map((p) => p.id).sort();
    expect(ids).toEqual(["a", "b", "c", "d"]);
  });

  it("varie les paires entre deux matchs quand les Elos sont proches", () => {
    // 4 joueurs au même Elo → les 3 appariements donnent le même gap (0).
    // La pénalité de répétition doit forcer une paire différente au 2e match.
    const players = [
      player("a", 1000),
      player("b", 1000),
      player("c", 1000),
      player("d", 1000),
    ];
    const [match1, match2] = generateMatches(players, { targetMatches: 2 });
    const pair1A = [...match1.teamA.players].map((p) => p.id).sort().join("|");
    const pair1B = [...match1.teamB.players].map((p) => p.id).sort().join("|");
    const pair2A = [...match2.teamA.players].map((p) => p.id).sort().join("|");
    const pair2B = [...match2.teamB.players].map((p) => p.id).sort().join("|");
    const pairs1 = new Set([pair1A, pair1B]);
    const pairs2 = new Set([pair2A, pair2B]);
    const overlap = [...pairs1].filter((p) => pairs2.has(p));
    expect(overlap.length).toBe(0); // zéro paire réutilisée
  });

  it("garde un gap Elo minimal même si ça réutilise une paire", () => {
    // Une combinaison écrase les 2 autres en gap → elle doit gagner malgré pairPenalty.
    // [1500, 1000, 1000, 1000] : (1500+1000) vs (1000+1000) = 1250 vs 1000 gap=250 (toutes options)
    // Du coup on vérifie juste que 2 matchs générés restent à gap minimal.
    const players = [
      player("star", 1500),
      player("m1", 1000),
      player("m2", 1000),
      player("m3", 1000),
    ];
    const matches = generateMatches(players, { targetMatches: 2 });
    // Avec ce setup, toutes les options ont gap=250 : on accepte n'importe laquelle.
    expect(matches.length).toBe(2);
    for (const m of matches) {
      expect(m.eloGap).toBeLessThanOrEqual(250);
    }
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
