"use server";

import { prisma } from "@/lib/prisma";
import {
  CreateTournamentSchema,
  EndTournamentSchema,
  RecordTournamentMatchSchema,
} from "@/lib/schemas";
import { assertAdmin } from "@/lib/admin-guard";
import { publishEvent } from "@/lib/realtime/bus";

export async function createTournament(raw: unknown): Promise<string> {
  await assertAdmin();
  const input = CreateTournamentSchema.parse(raw);
  const slotsJson = JSON.stringify(input.slots);
  const rows = await prisma.$queryRaw<{ create_tournament: string }[]>`
    select public.create_tournament(
      ${input.mode}::text,
      ${slotsJson}::jsonb,
      ${input.targetScore}::int,
      ${input.label ?? null}::text,
      ${input.sessionId ?? null}::uuid
    )
  `;
  const id = rows[0]?.create_tournament;
  if (!id) throw new Error("create_tournament a retourné un id vide.");
  publishEvent({ type: "tournament:created", tournamentId: id });
  return id;
}

export async function recordTournamentMatch(raw: unknown): Promise<string> {
  await assertAdmin();
  const input = RecordTournamentMatchSchema.parse(raw);
  const rows = await prisma.$queryRaw<{ record_tournament_match: string }[]>`
    select public.record_tournament_match(
      ${input.tournamentMatchId}::uuid,
      ${input.scoreA}::int,
      ${input.scoreB}::int
    )
  `;
  const matchId = rows[0]?.record_tournament_match;
  if (!matchId) throw new Error("record_tournament_match a échoué.");

  // Récupère le tournament_id pour l'event (et pour savoir si ce match est la finale).
  const tm = await prisma.tournamentMatch.findUnique({
    where: { id: input.tournamentMatchId },
    select: { tournamentId: true },
  });
  if (tm) {
    publishEvent({ type: "tournament:match-recorded", tournamentId: tm.tournamentId });
    const t = await prisma.tournament.findUnique({
      where: { id: tm.tournamentId },
      select: { status: true },
    });
    if (t?.status === "ended") {
      publishEvent({ type: "tournament:ended", tournamentId: tm.tournamentId });
    }
  }
  return matchId;
}

export async function endTournament(raw: unknown): Promise<void> {
  await assertAdmin();
  const input = EndTournamentSchema.parse(raw);
  await prisma.$executeRaw`
    select public.end_tournament(${input.tournamentId}::uuid)
  `;
  publishEvent({ type: "tournament:ended", tournamentId: input.tournamentId });
}
