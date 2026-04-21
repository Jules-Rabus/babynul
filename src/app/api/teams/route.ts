import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toTeamRow } from "@/lib/db/map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [teams, players] = await Promise.all([
    prisma.team.findMany({ orderBy: { elo: "desc" } }),
    prisma.player.findMany({
      select: { id: true, firstName: true, nickname: true },
    }),
  ]);
  const byId = new Map(
    players.map((p) => [
      p.id,
      { id: p.id, first_name: p.firstName, nickname: p.nickname },
    ]),
  );
  const out = teams.map((t) => ({
    ...toTeamRow(t),
    player1: byId.get(t.player1Id) ?? null,
    player2: byId.get(t.player2Id) ?? null,
  }));
  return NextResponse.json(out);
}
