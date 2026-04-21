import type { TTSProvider, TTSResult, TTSSpeakOptions } from "./provider";
import { TTSError } from "./provider";
import { createGeminiProvider } from "./providers/gemini";
import { createOpenAIProvider } from "./providers/openai";

type ProviderName = "gemini" | "openai";

function buildProvider(name: ProviderName): TTSProvider {
  if (name === "gemini") return createGeminiProvider();
  return createOpenAIProvider();
}

/**
 * Provider principal + fallback automatique si l'appel échoue.
 * Contrôlé par l'env VOICE_PROVIDER. Défaut: gemini.
 */
export function getTTSProvider(): TTSProvider {
  const primaryName = ((process.env.VOICE_PROVIDER ?? "gemini") as ProviderName);
  const fallbackName: ProviderName = primaryName === "gemini" ? "openai" : "gemini";

  const primary = buildProvider(primaryName);
  const fallback = buildProvider(fallbackName);

  return {
    name: `${primaryName}-with-${fallbackName}-fallback`,
    async speak(text: string, opts?: TTSSpeakOptions): Promise<TTSResult> {
      try {
        return await primary.speak(text, opts);
      } catch (err) {
        if (err instanceof TTSError) {
          console.error(`[voice] ${primary.name} failed, falling back:`, err.message);
          return fallback.speak(text, opts);
        }
        throw err;
      }
    },
  };
}
