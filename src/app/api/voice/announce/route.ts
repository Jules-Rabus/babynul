import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AnnounceRequestSchema } from "@/lib/schemas";
import { announceName } from "@/lib/player-display";
import { computeForm } from "@/lib/voice/player-form";
import {
  buildAnnouncePrompt,
  DEFAULT_VOICE_TEMPLATES,
  type AnnouncePlayer,
  type VoicePromptTemplates,
} from "@/lib/voice/build-announce-prompt";
import { generateAnnounceText } from "@/lib/voice/generate-announce-text";
import { getTTSProvider } from "@/lib/voice/registry";

// Shape DB-like consommé par computeForm (colonnes en snake_case).
type DBMatchRow = {
  id: string;
  mode: "individual" | "team";
  team_a_id: string | null;
  team_b_id: string | null;
  player_a1_id: string | null;
  player_a2_id: string | null;
  player_b1_id: string | null;
  player_b2_id: string | null;
  score_a: number;
  score_b: number;
  winner_side: "A" | "B";
  elo_delta_a: number;
  elo_delta_b: number;
  team_elo_delta_a: number | null;
  team_elo_delta_b: number | null;
  played_at: string;
  recorded_by: string | null;
  session_id: string | null;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  const parsed = AnnounceRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Paramètres invalides.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const body = parsed.data;

  try {
    const match = await prisma.proposedMatch.findUnique({
      where: { id: body.proposedMatchId },
    });
    if (!match) {
      return NextResponse.json({ error: "Match introuvable." }, { status: 404 });
    }

    const playerIds = [match.teamAP1, match.teamAP2, match.teamBP1, match.teamBP2].filter(
      (v): v is string => !!v,
    );
    const players = await prisma.player.findMany({
      where: { id: { in: playerIds } },
      select: { id: true, firstName: true, nickname: true },
    });
    const byId = new Map(players.map((p) => [p.id, p]));

    const sessionId = body.sessionId ?? match.sessionId ?? null;
    const recent = sessionId
      ? await prisma.match.findMany({
          where: { sessionId },
          orderBy: { playedAt: "desc" },
        })
      : await prisma.match.findMany({
          where: {
            playedAt: { gte: new Date(Date.now() - 30 * 86400000) },
          },
          orderBy: { playedAt: "desc" },
        });

    // Mapper les rows Prisma vers le shape attendu par computeForm (format DB Supabase-like)
    const matchList: DBMatchRow[] = recent.map((m) => ({
      id: m.id,
      mode: m.mode as "individual" | "team",
      team_a_id: m.teamAId,
      team_b_id: m.teamBId,
      player_a1_id: m.playerA1Id,
      player_a2_id: m.playerA2Id,
      player_b1_id: m.playerB1Id,
      player_b2_id: m.playerB2Id,
      score_a: m.scoreA,
      score_b: m.scoreB,
      winner_side: m.winnerSide as "A" | "B",
      elo_delta_a: m.eloDeltaA,
      elo_delta_b: m.eloDeltaB,
      team_elo_delta_a: m.teamEloDeltaA,
      team_elo_delta_b: m.teamEloDeltaB,
      played_at: m.playedAt.toISOString(),
      recorded_by: m.recordedBy,
      session_id: m.sessionId,
    }));

    const formsById = new Map<string, ReturnType<typeof computeForm>>();
    for (const id of playerIds) {
      formsById.set(id, computeForm(id, matchList, { sessionId }));
    }

    const toAnnounce = (ids: (string | null)[]): AnnouncePlayer[] =>
      ids
        .filter((v): v is string => !!v)
        .map((id) => {
          const p = byId.get(id);
          return {
            id,
            name: p ? announceName({ first_name: p.firstName, nickname: p.nickname }) : "Inconnu",
            form: formsById.get(id) ?? { kind: "neutral" },
          };
        });

    const ctx = {
      teamA: toAnnounce([match.teamAP1, match.teamAP2]),
      teamB: toAnnounce([match.teamBP1, match.teamBP2]),
    };

    // Lecture de la config prompt éditable côté admin.
    const cfg = await prisma.voicePromptConfig.findUnique({ where: { id: 1 } });
    const templates: VoicePromptTemplates = cfg
      ? {
          intro: cfg.intro,
          goat_template: cfg.goatTemplate,
          roast_template: cfg.roastTemplate,
          mixed_template: cfg.mixedTemplate,
        }
      : DEFAULT_VOICE_TEMPLATES;

    const prompt = buildAnnouncePrompt(ctx, templates);
    const text = await generateAnnounceText(prompt);

    const tts = getTTSProvider();
    const { audio, contentType } = await tts.speak(text);

    const meta = { forms: Object.fromEntries(formsById), text };
    return new Response(new Uint8Array(audio), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "X-Voice-Meta": Buffer.from(JSON.stringify(meta)).toString("base64"),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[/api/voice/announce] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur voice." },
      { status: 500 },
    );
  }
}
