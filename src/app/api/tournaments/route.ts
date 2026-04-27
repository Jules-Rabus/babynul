import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TournamentsQuerySchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const { status, date } = TournamentsQuerySchema.parse({
    status: url.searchParams.get("status") ?? undefined,
    date: url.searchParams.get("date") ?? undefined,
  });

  // Filtre "aujourd'hui" basé sur le fuseau du serveur.
  let startOfDay: Date | undefined;
  if (date === "today") {
    const now = new Date();
    startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  const tournaments = await prisma.tournament.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(startOfDay ? { startedAt: { gte: startOfDay } } : {}),
    },
    orderBy: { startedAt: "desc" },
    take: 50,
  });

  return NextResponse.json(
    tournaments.map((t) => ({
      id: t.id,
      label: t.label,
      mode: t.mode as "individual" | "team",
      size: t.size,
      rounds: t.rounds,
      target_score: t.targetScore,
      status: t.status as "active" | "ended",
      started_at: t.startedAt.toISOString(),
      ended_at: t.endedAt?.toISOString() ?? null,
      champion_player_id: t.championPlayerId,
      champion_team_id: t.championTeamId,
      session_id: t.sessionId,
    })),
  );
}
