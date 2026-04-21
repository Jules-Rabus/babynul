import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { announceName } from "@/lib/player-display";
import { computeForm } from "@/lib/voice/player-form";
import { buildAnnouncePrompt, type AnnouncePlayer } from "@/lib/voice/build-announce-prompt";
import { generateAnnounceText } from "@/lib/voice/generate-announce-text";
import { getTTSProvider } from "@/lib/voice/registry";
import type { MatchRow as DBMatchRow } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PlayerBrief = {
  id: string;
  first_name: string;
  nickname: string | null;
};

type ReqBody = {
  proposedMatchId: string;
  sessionId?: string | null;
};

function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env manquant côté serveur.");
  return createSupabaseClient(url, key);
}

export async function POST(req: Request) {
  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }
  if (!body?.proposedMatchId) {
    return NextResponse.json({ error: "proposedMatchId requis." }, { status: 400 });
  }

  try {
    const supabase = supabaseServer();

    const { data: match, error: matchErr } = await supabase
      .from("proposed_matches")
      .select(
        "id, mode, session_id, team_a_p1, team_a_p2, team_b_p1, team_b_p2, team_a_p1_player:players!proposed_matches_team_a_p1_fkey(id, first_name, nickname), team_a_p2_player:players!proposed_matches_team_a_p2_fkey(id, first_name, nickname), team_b_p1_player:players!proposed_matches_team_b_p1_fkey(id, first_name, nickname), team_b_p2_player:players!proposed_matches_team_b_p2_fkey(id, first_name, nickname)",
      )
      .eq("id", body.proposedMatchId)
      .single();
    if (matchErr || !match) {
      return NextResponse.json({ error: "Match introuvable." }, { status: 404 });
    }

    type ProposedMatchJoined = typeof match & {
      team_a_p1_player: PlayerBrief | null;
      team_a_p2_player: PlayerBrief | null;
      team_b_p1_player: PlayerBrief | null;
      team_b_p2_player: PlayerBrief | null;
    };
    const m = match as ProposedMatchJoined;

    const teamAPlayers = [m.team_a_p1_player, m.team_a_p2_player].filter(Boolean) as PlayerBrief[];
    const teamBPlayers = [m.team_b_p1_player, m.team_b_p2_player].filter(Boolean) as PlayerBrief[];
    const allIds = [...teamAPlayers, ...teamBPlayers].map((p) => p.id);

    // Charger les matchs récents pour calculer la forme.
    const sessionId = body.sessionId ?? m.session_id ?? null;
    let matchesQuery = supabase.from("matches").select("*").order("played_at", { ascending: false });
    if (sessionId) {
      matchesQuery = matchesQuery.eq("session_id", sessionId);
    } else {
      // 30 derniers jours si pas de session
      matchesQuery = matchesQuery.gte(
        "played_at",
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      );
    }
    const { data: recent, error: recentErr } = await matchesQuery;
    if (recentErr) throw recentErr;

    const formsById = new Map<string, ReturnType<typeof computeForm>>();
    const matchList = (recent ?? []) as DBMatchRow[];
    for (const id of allIds) {
      formsById.set(id, computeForm(id, matchList, { sessionId }));
    }

    const toAnnounce = (players: PlayerBrief[]): AnnouncePlayer[] =>
      players.map((p) => ({
        id: p.id,
        name: announceName(p),
        form: formsById.get(p.id) ?? { kind: "neutral" },
      }));

    const ctx = {
      teamA: toAnnounce(teamAPlayers),
      teamB: toAnnounce(teamBPlayers),
    };

    const prompt = buildAnnouncePrompt(ctx);
    const text = await generateAnnounceText(prompt);

    const tts = getTTSProvider();
    const { audio, contentType } = await tts.speak(text);

    const meta = {
      forms: Object.fromEntries(formsById),
      text,
    };

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
