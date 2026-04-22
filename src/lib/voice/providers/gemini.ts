import type { TTSProvider, TTSResult, TTSSpeakOptions } from "../provider";
import { TTSError } from "../provider";

function extractRate(mime: string): number | null {
  const m = /rate=(\d+)/i.exec(mime);
  return m ? Number.parseInt(m[1], 10) : null;
}

function wrapPcmAsWav(
  pcm: Buffer,
  { sampleRate, channels, bitsPerSample }: { sampleRate: number; channels: number; bitsPerSample: number },
): Uint8Array {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return new Uint8Array(Buffer.concat([header, pcm]));
}

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
        const pcm = Buffer.from(part.data, "base64");
        const mime = part.mimeType ?? "";
        // Gemini renvoie du PCM brut (L16) ex: "audio/L16;rate=24000".
        // Les navigateurs ne savent pas le décoder → on enveloppe dans un header WAV.
        if (/^audio\/(l16|pcm)/i.test(mime) || /\bcodec=pcm\b/i.test(mime)) {
          const sampleRate = extractRate(mime) ?? 24000;
          const wav = wrapPcmAsWav(pcm, { sampleRate, channels: 1, bitsPerSample: 16 });
          return { audio: wav, contentType: "audio/wav" };
        }
        return { audio: new Uint8Array(pcm), contentType: mime || "audio/wav" };
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
