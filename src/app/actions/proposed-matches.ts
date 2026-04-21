"use server";

import { prisma } from "@/lib/prisma";
import {
  CreateProposedMatchSchema,
  CancelProposedMatchSchema,
  ResolveProposedMatchSchema,
} from "@/lib/schemas";
import { assertAdmin } from "@/lib/admin-guard";

export async function createProposedMatch(raw: unknown): Promise<string> {
  await assertAdmin();
  const input = CreateProposedMatchSchema.parse(raw);
  const row = await prisma.proposedMatch.create({
    data: {
      mode: input.mode,
      teamAP1: input.team_a_p1,
      teamAP2: input.team_a_p2,
      teamBP1: input.team_b_p1,
      teamBP2: input.team_b_p2,
      eloA: input.elo_a,
      eloB: input.elo_b,
      sessionId: input.session_id ?? null,
    },
    select: { id: true },
  });
  return row.id;
}

export async function cancelProposedMatch(raw: unknown): Promise<void> {
  await assertAdmin();
  const input = CancelProposedMatchSchema.parse(raw);
  await prisma.$executeRaw`
    select public.cancel_proposed_match(${input.proposedMatchId}::uuid)
  `;
}

export async function resolveProposedMatch(raw: unknown): Promise<void> {
  await assertAdmin();
  const input = ResolveProposedMatchSchema.parse(raw);
  await prisma.$executeRaw`
    select public.resolve_proposed_match(
      ${input.proposedMatchId}::uuid,
      ${input.winnerSide}::text,
      ${input.matchId ?? null}::uuid
    )
  `;
}
