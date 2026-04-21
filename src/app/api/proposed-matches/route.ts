import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ProposedMatchesQuerySchema } from "@/lib/schemas";
import { toProposedMatchRow } from "@/lib/db/map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const { sessionId } = ProposedMatchesQuerySchema.parse({
    sessionId: url.searchParams.get("sessionId") ?? undefined,
  });

  const matches = await prisma.proposedMatch.findMany({
    where: sessionId ? { sessionId } : undefined,
    orderBy: { createdAt: sessionId ? "asc" : "desc" },
  });

  const ids = new Set<string>();
  for (const m of matches) {
    ids.add(m.teamAP1);
    if (m.teamAP2) ids.add(m.teamAP2);
    ids.add(m.teamBP1);
    if (m.teamBP2) ids.add(m.teamBP2);
  }
  const players = await prisma.player.findMany({
    where: { id: { in: Array.from(ids) } },
    select: { id: true, firstName: true, nickname: true },
  });
  const byId = new Map(
    players.map((p) => [
      p.id,
      { id: p.id, first_name: p.firstName, nickname: p.nickname },
    ]),
  );

  const out = matches.map((m) => ({
    ...toProposedMatchRow(m),
    team_a_p1_player: byId.get(m.teamAP1) ?? null,
    team_a_p2_player: m.teamAP2 ? byId.get(m.teamAP2) ?? null : null,
    team_b_p1_player: byId.get(m.teamBP1) ?? null,
    team_b_p2_player: m.teamBP2 ? byId.get(m.teamBP2) ?? null : null,
  }));

  return NextResponse.json(out);
}
