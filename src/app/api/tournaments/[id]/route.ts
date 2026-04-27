import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { TournamentWithGraph } from "@/lib/db/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const tournament = await prisma.tournament.findUnique({ where: { id } });
  if (!tournament) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [participants, matches] = await Promise.all([
    prisma.tournamentParticipant.findMany({
      where: { tournamentId: id },
      orderBy: { slot: "asc" },
    }),
    prisma.tournamentMatch.findMany({
      where: { tournamentId: id },
      orderBy: [{ round: "desc" }, { slot: "asc" }],
    }),
  ]);

  const playerIds = new Set<string>();
  for (const p of participants) {
    if (p.playerId) playerIds.add(p.playerId);
    if (p.teamP1Id) playerIds.add(p.teamP1Id);
    if (p.teamP2Id) playerIds.add(p.teamP2Id);
  }
  const players = await prisma.player.findMany({
    where: { id: { in: Array.from(playerIds) } },
    select: { id: true, firstName: true, nickname: true, elo: true },
  });
  const byId = new Map(
    players.map((p) => [p.id, { id: p.id, first_name: p.firstName, nickname: p.nickname, elo: p.elo }]),
  );

  const payload: TournamentWithGraph = {
    tournament: {
      id: tournament.id,
      label: tournament.label,
      mode: tournament.mode as "individual" | "team",
      size: tournament.size,
      rounds: tournament.rounds,
      target_score: tournament.targetScore,
      status: tournament.status as "active" | "ended",
      started_at: tournament.startedAt.toISOString(),
      ended_at: tournament.endedAt?.toISOString() ?? null,
      champion_player_id: tournament.championPlayerId,
      champion_team_id: tournament.championTeamId,
      session_id: tournament.sessionId,
    },
    participants: participants.map((p) => ({
      tournament_id: p.tournamentId,
      slot: p.slot,
      seed: p.seed,
      player_id: p.playerId,
      team_p1_id: p.teamP1Id,
      team_p2_id: p.teamP2Id,
      label: p.label,
      player: p.playerId ? byId.get(p.playerId) ?? null : null,
      team_p1: p.teamP1Id ? byId.get(p.teamP1Id) ?? null : null,
      team_p2: p.teamP2Id ? byId.get(p.teamP2Id) ?? null : null,
    })),
    matches: matches.map((m) => ({
      id: m.id,
      tournament_id: m.tournamentId,
      round: m.round,
      slot: m.slot,
      side_a_slot: m.sideASlot,
      side_b_slot: m.sideBSlot,
      winner_slot: m.winnerSlot,
      match_id: m.matchId,
      status: m.status as "pending" | "ready" | "played" | "bye",
    })),
  };

  return NextResponse.json(payload);
}
