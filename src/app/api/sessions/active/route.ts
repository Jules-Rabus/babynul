import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toPlaySessionRow } from "@/lib/db/map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await prisma.playSession.findFirst({
    where: { status: "active" },
    orderBy: { startedAt: "desc" },
  });
  if (!session) return NextResponse.json(null);

  const [participants, players] = await Promise.all([
    prisma.sessionPlayer.findMany({
      where: { sessionId: session.id },
      orderBy: { joinedAt: "asc" },
    }),
    prisma.player.findMany({
      select: {
        id: true,
        firstName: true,
        nickname: true,
        elo: true,
        gamesPlayed: true,
      },
    }),
  ]);
  const byId = new Map(
    players.map((p) => [
      p.id,
      {
        id: p.id,
        first_name: p.firstName,
        nickname: p.nickname,
        elo: p.elo,
        games_played: p.gamesPlayed,
      },
    ]),
  );

  return NextResponse.json({
    session: toPlaySessionRow(session),
    participants: participants.map((p) => ({
      session_id: p.sessionId,
      player_id: p.playerId,
      is_present: p.isPresent,
      joined_at: p.joinedAt.toISOString(),
      left_at: p.leftAt?.toISOString() ?? null,
      player: byId.get(p.playerId) ?? null,
    })),
  });
}
