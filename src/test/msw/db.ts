// Store en mémoire partagé par les handlers MSW, reseedable dans les tests.
import type { PlayerRow, MatchRow, PlaySessionRow } from "@/lib/supabase/types";

export type MSWState = {
  players: PlayerRow[];
  matches: MatchRow[];
  sessions: PlaySessionRow[];
  session_players: Array<{ session_id: string; player_id: string; is_present: boolean; joined_at: string; left_at: string | null }>;
};

function emptyState(): MSWState {
  return { players: [], matches: [], sessions: [], session_players: [] };
}

export const db: { state: MSWState } = { state: emptyState() };

export function reset(seed?: Partial<MSWState>) {
  db.state = { ...emptyState(), ...(seed ?? {}) };
}
