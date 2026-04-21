import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { WagersQuerySchema } from "@/lib/schemas";
import { toWagerRow } from "@/lib/db/map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const { proposedMatchId } = WagersQuerySchema.parse({
    proposedMatchId: url.searchParams.get("proposedMatchId"),
  });
  const rows = await prisma.wager.findMany({
    where: { proposedMatchId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(rows.map(toWagerRow));
}
