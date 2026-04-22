"use server";

import { prisma } from "@/lib/prisma";
import { PlaceWagerSchema } from "@/lib/schemas";
import { publishEvent } from "@/lib/realtime/bus";

// Pas d'assertAdmin ici : tout le monde peut parier avec son propre player_id.
// La RPC vérifie que le solde est suffisant.
export async function placeWager(raw: unknown): Promise<string> {
  const input = PlaceWagerSchema.parse(raw);
  const rows = await prisma.$queryRaw<{ place_wager: string }[]>`
    select public.place_wager(
      ${input.playerId}::uuid,
      ${input.proposedMatchId}::uuid,
      ${input.side}::text,
      ${input.stake}::int
    )
  `;
  const id = rows[0]?.place_wager;
  if (!id) throw new Error("Impossible de placer le pari.");
  publishEvent({ type: "wager:changed", proposedMatchId: input.proposedMatchId });
  return id;
}
