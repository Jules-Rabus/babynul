// En mode mock (NEXT_PUBLIC_USE_MSW=1), on utilise des valeurs factices
// pour que createBrowserClient ne throw pas. Les handlers MSW interceptent
// l'URL, donc le contenu n'est jamais vraiment requêté.
const MOCK_URL = "https://mock.supabase.local";
const MOCK_KEY = "mock-publishable-key";

export function getSupabaseEnv() {
  const mockMode = process.env.NEXT_PUBLIC_USE_MSW === "1";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || (mockMode ? MOCK_URL : undefined);
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    (mockMode ? MOCK_KEY : undefined);

  if (!url || !key) {
    throw new Error(
      "Variables d'environnement Supabase manquantes. Définir NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (ou NEXT_PUBLIC_SUPABASE_ANON_KEY).",
    );
  }

  return { url, key };
}
