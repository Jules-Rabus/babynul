import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

// Note: le typage Database generic de supabase-js v2 est strict et peu compatible
// avec les RPC à arguments nullables. On reste sur le client non typé ; les rows
// sont converties explicitement via les types PlayerRow / TeamRow / MatchRow.
export function createClient() {
  const { url, key } = getSupabaseEnv();
  return createBrowserClient(url, key);
}
