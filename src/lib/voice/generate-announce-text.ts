/**
 * Appelle Gemini (ou OpenAI en fallback) pour générer la phrase d'annonce.
 * Entrée = prompt construit par buildAnnouncePrompt. Sortie = phrase prête à lire.
 */
export async function generateAnnounceText(prompt: string): Promise<string> {
  const geminiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (geminiKey) {
    try {
      return await generateWithGemini(prompt, geminiKey);
    } catch (err) {
      console.error("[voice] Gemini text failed, fallback to OpenAI:", err);
      if (!openaiKey) throw err;
    }
  }

  if (openaiKey) {
    return generateWithOpenAI(prompt, openaiKey);
  }

  throw new Error("Aucune clé LLM configurée (GOOGLE_GENERATIVE_AI_API_KEY ou OPENAI_API_KEY).");
}

async function generateWithGemini(prompt: string, apiKey: string): Promise<string> {
  const model = process.env.VOICE_TEXT_MODEL ?? "gemini-2.0-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.9, maxOutputTokens: 200 },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini text ${res.status}: ${await res.text().catch(() => "")}`);
  type Resp = {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const json = (await res.json()) as Resp;
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error("Gemini text: réponse vide");
  return text;
}

async function generateWithOpenAI(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.9,
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI text ${res.status}: ${await res.text().catch(() => "")}`);
  type Resp = { choices?: Array<{ message?: { content?: string } }> };
  const json = (await res.json()) as Resp;
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OpenAI text: réponse vide");
  return text;
}
