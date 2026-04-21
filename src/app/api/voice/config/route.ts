import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_VOICE_TEMPLATES } from "@/lib/voice/build-announce-prompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const row = await prisma.voicePromptConfig.findUnique({ where: { id: 1 } });
  if (!row) return NextResponse.json(DEFAULT_VOICE_TEMPLATES);
  return NextResponse.json({
    intro: row.intro,
    goat_template: row.goatTemplate,
    roast_template: row.roastTemplate,
    mixed_template: row.mixedTemplate,
  });
}
