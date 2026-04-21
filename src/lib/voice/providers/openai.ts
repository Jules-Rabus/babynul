import type { TTSProvider, TTSResult, TTSSpeakOptions } from "../provider";
import { TTSError } from "../provider";

const OPENAI_VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as const;

export function createOpenAIProvider(opts?: {
  apiKey?: string;
  model?: string;
}): TTSProvider {
  const apiKey = opts?.apiKey ?? process.env.OPENAI_API_KEY;
  const model = opts?.model ?? "gpt-4o-mini-tts";

  return {
    name: "openai",
    async speak(text: string, options: TTSSpeakOptions = {}): Promise<TTSResult> {
      if (!apiKey) {
        throw new TTSError("OPENAI_API_KEY manquante", "openai");
      }
      const voice =
        options.voice ??
        OPENAI_VOICES[Math.floor(Math.random() * OPENAI_VOICES.length)];

      try {
        const res = await fetch("https://api.openai.com/v1/audio/speech", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            voice,
            input: text,
            response_format: "mp3",
          }),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new TTSError(`OpenAI TTS ${res.status}: ${errText}`, "openai");
        }
        const buf = new Uint8Array(await res.arrayBuffer());
        return { audio: buf, contentType: "audio/mpeg" };
      } catch (err) {
        if (err instanceof TTSError) throw err;
        throw new TTSError(
          err instanceof Error ? err.message : "OpenAI TTS: erreur inconnue",
          "openai",
          err,
        );
      }
    },
  };
}
