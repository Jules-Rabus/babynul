"use server";

import { prisma } from "@/lib/prisma";
import { RecordMatchSchema } from "@/lib/schemas";
import { assertAdmin } from "@/lib/admin-guard";

export async function recordMatch(raw: unknown): Promise<string> {
  await assertAdmin();
  const input = RecordMatchSchema.parse(raw);

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ record_match_v2: string }[]>`
      select public.record_match_v2(
        ${input.mode}::text,
        ${input.a1}::uuid,
        ${input.a2 ?? null}::uuid,
        ${input.b1}::uuid,
        ${input.b2 ?? null}::uuid,
        ${input.scoreA}::int,
        ${input.scoreB}::int,
        ${input.sessionId ?? null}::uuid
      )
    `;
    const matchId = rows[0]?.record_match_v2;
    if (!matchId) throw new Error("record_match_v2 a retourné un id vide.");

    if (input.proposedMatchId) {
      const winnerSide = input.scoreA > input.scoreB ? "A" : "B";
      await tx.$executeRaw`
        select public.resolve_proposed_match(
          ${input.proposedMatchId}::uuid,
          ${winnerSide}::text,
          ${matchId}::uuid
        )
      `;
    }
    return matchId;
  });
}

export async function undoLastMatch(): Promise<string> {
  await assertAdmin();
  const rows = await prisma.$queryRaw<{ undo_last_match: string }[]>`
    select public.undo_last_match()
  `;
  const id = rows[0]?.undo_last_match;
  if (!id) throw new Error("Aucun match à annuler.");
  return id;
}
