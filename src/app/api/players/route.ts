import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toPlayerRow } from "@/lib/db/map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await prisma.player.findMany({
    orderBy: { elo: "desc" },
  });
  return NextResponse.json(rows.map(toPlayerRow));
}
