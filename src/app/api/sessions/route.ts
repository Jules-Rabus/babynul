import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toPlaySessionRow } from "@/lib/db/map";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  status: z.enum(["active", "ended"]).optional(),
  date: z.enum(["today"]).optional(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const { status, date } = QuerySchema.parse({
    status: url.searchParams.get("status") ?? undefined,
    date: url.searchParams.get("date") ?? undefined,
  });

  let startOfDay: Date | undefined;
  if (date === "today") {
    const now = new Date();
    startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  const sessions = await prisma.playSession.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(startOfDay ? { startedAt: { gte: startOfDay } } : {}),
    },
    orderBy: { startedAt: "desc" },
    take: 50,
  });

  const ids = sessions.map((s) => s.id);
  const matchCounts = ids.length
    ? await prisma.match.groupBy({
        by: ["sessionId"],
        where: { sessionId: { in: ids } },
        _count: { _all: true },
      })
    : [];
  const countBySession = new Map(
    matchCounts.map((m) => [m.sessionId ?? "", m._count._all]),
  );

  return NextResponse.json(
    sessions.map((s) => ({
      ...toPlaySessionRow(s),
      match_count: countBySession.get(s.id) ?? 0,
    })),
  );
}
