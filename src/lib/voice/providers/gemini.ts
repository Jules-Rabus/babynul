import type { TTSProvider, TTSResult, TTSSpeakOptions } from "../provider";
import { TTSError } from "../provider";

/**
 * Provider Gemini TTS. Appel direct à l'API REST generateContent
 * avec responseModalities: ["AUDIO"] (mode TTS natif preview).
 * Modèle : gemini-3.1-flash-tts-preview.
 */
export function createGeminiProvider(opts?: {
  apiKey?: string;
  model?: string;
}): TTSProvider {
  const apiKey = opts?.apiKey ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const model = opts?.model ?? "gemini-3.1-flash-tts-preview";

  return {
    name: "gemini",
    async speak(text: string, options: TTSSpeakOptions = {}): Promise<TTSResult> {
      if (!apiKey) {
        throw new TTSError("GOOGLE_GENERATIVE_AI_API_KEY manquante", "gemini");
      }
      const voice = options.voice ?? "Kore";

      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text }] }],
              generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: voice },
                  },
                },
              },
            }),
          },
        );
        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new TTSError(`Gemini TTS ${res.status}: ${errText}`, "gemini");
        }
        type GeminiResp = {
          candidates?: Array<{
            content?: {
              parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }>;
            };
          }>;
        };
        const json = (await res.json()) as GeminiResp;
        const part = json.candidates?.[0]?.content?.parts?.[0]?.inlineData;
        if (!part?.data) {
          throw new TTSError("Gemini TTS: réponse sans audio", "gemini");
        }
        const bytes = Uint8Array.from(Buffer.from(part.data, "base64"));
        return { audio: bytes, contentType: part.mimeType ?? "audio/wav" };
      } catch (err) {
        if (err instanceof TTSError) throw err;
        throw new TTSError(
          err instanceof Error ? err.message : "Gemini TTS: erreur inconnue",
          "gemini",
          err,
        );
      }
    },
  };
}
