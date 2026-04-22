"use server";

import { prisma } from "@/lib/prisma";
import {
  CreateProposedMatchSchema,
  CancelProposedMatchSchema,
  ResolveProposedMatchSchema,
} from "@/lib/schemas";
import { assertAdmin } from "@/lib/admin-guard";
import { publishEvent } from "@/lib/realtime/bus";

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
  publishEvent({ type: "proposed-match:created", sessionId: input.session_id ?? null });
  return row.id;
}

export async function cancelProposedMatch(raw: unknown): Promise<void> {
  await assertAdmin();
  const input = CancelProposedMatchSchema.parse(raw);
  const existing = await prisma.proposedMatch.findUnique({
    where: { id: input.proposedMatchId },
    select: { sessionId: true },
  });
  await prisma.$executeRaw`
    select public.cancel_proposed_match(${input.proposedMatchId}::uuid)
  `;
  publishEvent({ type: "proposed-match:cancelled", sessionId: existing?.sessionId ?? null });
}

export async function resolveProposedMatch(raw: unknown): Promise<void> {
  await assertAdmin();
  const input = ResolveProposedMatchSchema.parse(raw);
  const existing = await prisma.proposedMatch.findUnique({
    where: { id: input.proposedMatchId },
    select: { sessionId: true },
  });
  await prisma.$executeRaw`
    select public.resolve_proposed_match(
      ${input.proposedMatchId}::uuid,
      ${input.winnerSide}::text,
      ${input.matchId ?? null}::uuid
    )
  `;
  publishEvent({ type: "match:recorded", sessionId: existing?.sessionId ?? null });
}
