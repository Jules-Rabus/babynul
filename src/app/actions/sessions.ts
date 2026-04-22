"use server";

import { prisma } from "@/lib/prisma";
import {
  StartSessionSchema,
  EndSessionSchema,
  SessionPresenceSchema,
  CancelOpenSessionMatchesSchema,
} from "@/lib/schemas";
import { assertAdmin } from "@/lib/admin-guard";
import { publishEvent } from "@/lib/realtime/bus";

export async function startSession(raw: unknown): Promise<string> {
  await assertAdmin();
  const input = StartSessionSchema.parse(raw ?? {});
  const rows = await prisma.$queryRaw<{ start_play_session: string }[]>`
    select public.start_play_session(${input.label ?? null}::text)
  `;
  const id = rows[0]?.start_play_session;
  if (!id) throw new Error("Impossible de démarrer le tournoi.");
  publishEvent({ type: "session:started", sessionId: id });
  return id;
}

export async function endSession(raw: unknown): Promise<void> {
  await assertAdmin();
  const input = EndSessionSchema.parse(raw);
  await prisma.$executeRaw`
    select public.end_play_session(${input.sessionId}::uuid)
  `;
  publishEvent({ type: "session:ended", sessionId: input.sessionId });
}

export async function setSessionPresence(raw: unknown): Promise<void> {
  await assertAdmin();
  const input = SessionPresenceSchema.parse(raw);
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      select public.set_session_presence(
        ${input.sessionId}::uuid,
        ${input.playerId}::uuid,
        ${input.present}::boolean
      )
    `;
    if (!input.present) {
      await tx.$executeRaw`
        select public.cancel_open_matches_for_session(
          ${input.sessionId}::uuid,
          ${input.playerId}::uuid
        )
      `;
    }
  });
  publishEvent({ type: "session:presence-changed", sessionId: input.sessionId });
  if (!input.present) {
    publishEvent({ type: "proposed-match:cancelled", sessionId: input.sessionId });
  }
}

export async function cancelOpenSessionMatches(raw: unknown): Promise<number> {
  await assertAdmin();
  const input = CancelOpenSessionMatchesSchema.parse(raw);
  const rows = await prisma.$queryRaw<{ cancel_open_matches_for_session: number }[]>`
    select public.cancel_open_matches_for_session(
      ${input.sessionId}::uuid,
      ${input.involvingPlayer ?? null}::uuid
    )
  `;
  publishEvent({ type: "proposed-match:cancelled", sessionId: input.sessionId });
  return rows[0]?.cancel_open_matches_for_session ?? 0;
}
