import type { MatchRow } from "@/lib/db/types";

// Slot d'un joueur dans la ligne match : a1/a2/b1/b2.
export type MatchSlot = "a1" | "a2" | "b1" | "b2";

// Renvoie le delta Elo réellement appliqué à un slot.
// En 2v2 post-0018, on lit le delta individuel (carry intra-équipe).
// Avant 0018 (colonne null), on retombe sur la moyenne d'équipe — c'est la
// valeur effectivement appliquée à l'époque (sans carry stocké).
export function deltaForSlot(m: MatchRow, slot: MatchSlot): number {
  const sideAvg = slot.startsWith("a") ? m.elo_delta_a : m.elo_delta_b;
  const indiv =
    slot === "a1"
      ? m.elo_delta_a1
      : slot === "a2"
        ? m.elo_delta_a2
        : slot === "b1"
          ? m.elo_delta_b1
          : m.elo_delta_b2;
  return indiv ?? sideAvg;
}

// Slot d'un joueur dans une ligne match, ou null si pas impliqué.
export function slotForPlayer(m: MatchRow, playerId: string): MatchSlot | null {
  if (m.player_a1_id === playerId) return "a1";
  if (m.player_a2_id === playerId) return "a2";
  if (m.player_b1_id === playerId) return "b1";
  if (m.player_b2_id === playerId) return "b2";
  return null;
}

// Delta Elo réellement appliqué à un joueur sur ce match.
export function deltaForPlayer(m: MatchRow, playerId: string): number {
  const slot = slotForPlayer(m, playerId);
  return slot ? deltaForSlot(m, slot) : 0;
}
