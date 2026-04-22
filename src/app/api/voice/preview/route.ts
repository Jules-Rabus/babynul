import { NextResponse } from "next/server";
import {
  buildAnnouncePrompt,
  DEFAULT_VOICE_TEMPLATES,
  type AnnounceContext,
  type VoicePromptTemplates,
} from "@/lib/voice/build-announce-prompt";
import { generateAnnounceText } from "@/lib/voice/generate-announce-text";
import { getTTSProvider } from "@/lib/voice/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReqBody = {
  templates?: Partial<VoicePromptTemplates>;
  context?: AnnounceContext;
  withAudio?: boolean;
};

/**
 * Dry-run de l'éditeur de prompt admin. Renvoie la phrase générée
 * et, si withAudio=true, l'audio TTS en base64.
 */
export async function POST(req: Request) {
  let body: ReqBody = {};
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    // on accepte un body vide → contexte par défaut
  }

  const templates: VoicePromptTemplates = {
    ...DEFAULT_VOICE_TEMPLATES,
    ...(body.templates ?? {}),
  };

  // Contexte fictif. Les "noms" ici sont des announceName (surnom si défini côté
  // player, sinon prénom) — c'est ce que reçoit le LLM en prod, cf announceName().
  const ctx: AnnounceContext = body.context ?? {
    teamA: [
      { id: "demo1", name: "Lucas", form: { kind: "goat", streak: 4 } },
      { id: "demo2", name: "Théo", form: { kind: "neutral" } },
    ],
    teamB: [
      { id: "demo3", name: "Sarah", form: { kind: "roast", streak: 3 } },
      { id: "demo4", name: "Antoine", form: { kind: "neutral" } },
    ],
  };

  try {
    const prompt = buildAnnouncePrompt(ctx, templates);
    const text = await generateAnnounceText(prompt);

    if (!body.withAudio) {
      return NextResponse.json({ text, prompt });
    }

    const tts = getTTSProvider();
    const { audio, contentType } = await tts.speak(text);
    const audioBase64 = Buffer.from(audio).toString("base64");
    return NextResponse.json({ text, prompt, audio: audioBase64, contentType });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur preview." },
      { status: 500 },
    );
  }
}
