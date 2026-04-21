export type TTSSpeakOptions = {
  /** Voix à utiliser (provider-specific). */
  voice?: string;
  /** Style (excited, teasing, neutral, etc.) — mappé au provider. */
  style?: "excited" | "teasing" | "neutral";
};

export type TTSResult = {
  /** Bytes audio bruts. */
  audio: Uint8Array;
  /** Type MIME (ex: audio/mpeg, audio/wav). */
  contentType: string;
};

export interface TTSProvider {
  readonly name: string;
  speak(text: string, opts?: TTSSpeakOptions): Promise<TTSResult>;
}

export class TTSError extends Error {
  constructor(message: string, public readonly providerName: string, public readonly cause?: unknown) {
    super(message);
    this.name = "TTSError";
  }
}
