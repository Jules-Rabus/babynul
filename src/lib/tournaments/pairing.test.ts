import { describe, it, expect } from "vitest";
import { buildBalancedPairs, type PairingPlayer } from "./pairing";
import { pairKey } from "@/lib/pairs";

function mkPlayers(n: number): PairingPlayer[] {
  return Array.from({ length: n }, (_, i) => ({ id: `P${i}`, elo: 1000 + i * 10 }));
}

describe("buildBalancedPairs", () => {
  it("échoue sur un nombre impair", () => {
    expect(() => buildBalancedPairs(mkPlayers(3))).toThrow();
  });

  it("renvoie exactement n/2 paires", () => {
    const pairs = buildBalancedPairs(mkPlayers(8));
    expect(pairs).toHaveLength(4);
  });

  it("les paires couvrent tous les joueurs sans répétition", () => {
    const players = mkPlayers(6);
    const pairs = buildBalancedPairs(players);
    const ids = pairs.flatMap(([a, b]) => [a.id, b.id]);
    expect(new Set(ids).size).toBe(players.length);
  });

  it("évite les paires déjà vues si possible", () => {
    const players = mkPlayers(4); // 3 partitions possibles
    const seen = new Set([pairKey("P0", "P1"), pairKey("P2", "P3")]);
    // Seule partition sans répétition : (P0,P2)/(P1,P3) ou (P0,P3)/(P1,P2)
    const pairs = buildBalancedPairs(players, { seenPairs: seen, rng: () => 0 });
    for (const [a, b] of pairs) {
      expect(seen.has(pairKey(a.id, b.id))).toBe(false);
    }
  });

  it("accepte une paire vue si toutes les partitions en contiennent", () => {
    const players = mkPlayers(4);
    const seen = new Set([
      pairKey("P0", "P1"),
      pairKey("P0", "P2"),
      pairKey("P0", "P3"),
      pairKey("P1", "P2"),
      pairKey("P1", "P3"),
      pairKey("P2", "P3"),
    ]);
    // Toutes les 6 paires possibles sont vues ⇒ la fonction ne doit pas planter.
    expect(() => buildBalancedPairs(players, { seenPairs: seen })).not.toThrow();
  });

  it("est déterministe à rng fixé", () => {
    const players = mkPlayers(8);
    const rng = () => 0.5;
    const a = buildBalancedPairs(players, { rng });
    const b = buildBalancedPairs(players, { rng });
    expect(
      a.map(([x, y]) => pairKey(x.id, y.id)).sort(),
    ).toEqual(b.map(([x, y]) => pairKey(x.id, y.id)).sort());
  });

  it("sur 2 générations successives, alterne les partenaires", () => {
    const players = mkPlayers(8);
    const seen = new Set<string>();
    const gen1 = buildBalancedPairs(players, { seenPairs: seen, rng: () => 0 });
    for (const [a, b] of gen1) seen.add(pairKey(a.id, b.id));
    const gen2 = buildBalancedPairs(players, { seenPairs: seen, rng: () => 0 });
    const seen2 = gen2.map(([a, b]) => pairKey(a.id, b.id));
    // Aucune paire de la gen2 ne doit déjà figurer dans gen1 (105 partitions, plein d'alternatives).
    for (const key of seen2) expect(seen.has(key)).toBe(false);
  });
});
