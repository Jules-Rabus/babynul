import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  PlayerMatchesQuerySchema,
  RecentMatchesQuerySchema,
  SessionMatchesQuerySchema,
} from "@/lib/schemas";
import { toMatchRow } from "@/lib/db/map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ScopeSchema = z.enum(["recent", "player", "session"]);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const scope = ScopeSchema.parse(url.searchParams.get("scope") ?? "recent");

  if (scope === "recent") {
    const { days } = RecentMatchesQuerySchema.parse({
      days: url.searchParams.get("days") ?? undefined,
    });
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await prisma.match.findMany({
      where: { playedAt: { gte: since } },
      orderBy: { playedAt: "desc" },
    });
    return NextResponse.json(rows.map(toMatchRow));
  }

  if (scope === "player") {
    const { playerId, limit } = PlayerMatchesQuerySchema.parse({
      playerId: url.searchParams.get("playerId"),
      limit: url.searchParams.get("limit") ?? undefined,
    });
    const rows = await prisma.match.findMany({
      where: {
        OR: [
          { playerA1Id: playerId },
          { playerA2Id: playerId },
          { playerB1Id: playerId },
          { playerB2Id: playerId },
        ],
      },
      orderBy: { playedAt: "desc" },
      take: limit,
    });
    return NextResponse.json(rows.map(toMatchRow));
  }

  const { sessionId } = SessionMatchesQuerySchema.parse({
    sessionId: url.searchParams.get("sessionId"),
  });
  const rows = await prisma.match.findMany({
    where: { sessionId },
    orderBy: { playedAt: "desc" },
  });
  return NextResponse.json(rows.map(toMatchRow));
}
