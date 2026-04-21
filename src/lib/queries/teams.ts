"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { TeamRow, PlayerRow } from "@/lib/supabase/types";

export type TeamWithPlayers = TeamRow & {
  player1: Pick<PlayerRow, "id" | "first_name" | "nickname"> | null;
  player2: Pick<PlayerRow, "id" | "first_name" | "nickname"> | null;
};

export const TEAMS_KEY = ["teams"] as const;

export function useTeams() {
  return useQuery({
    queryKey: TEAMS_KEY,
    queryFn: async (): Promise<TeamWithPlayers[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("teams")
        .select(
          "*, player1:players!teams_player1_id_fkey(id, first_name, nickname), player2:players!teams_player2_id_fkey(id, first_name, nickname)",
        )
        .order("elo", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown) as TeamWithPlayers[];
    },
  });
}
