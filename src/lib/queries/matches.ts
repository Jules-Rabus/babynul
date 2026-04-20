"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { MatchRow } from "@/lib/supabase/types";

export const MATCHES_KEY = ["matches"] as const;

export type RecordMatchInput = {
  mode: "individual" | "team";
  a1: string;
  a2: string | null;
  b1: string;
  b2: string | null;
  scoreA: number;
  scoreB: number;
};

export function useRecordMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RecordMatchInput) => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("record_match", {
        p_mode: input.mode,
        p_a1: input.a1,
        p_a2: input.a2,
        p_b1: input.b1,
        p_b2: input.b2,
        p_score_a: input.scoreA,
        p_score_b: input.scoreB,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MATCHES_KEY });
      qc.invalidateQueries({ queryKey: ["players"] });
      qc.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

export function useRecentMatches(days = 30) {
  return useQuery({
    queryKey: ["matches", "recent", days],
    queryFn: async (): Promise<MatchRow[]> => {
      const supabase = createClient();
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .gte("played_at", since)
        .order("played_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MatchRow[];
    },
  });
}

export function usePlayerMatches(playerId: string | null) {
  return useQuery({
    queryKey: ["matches", "player", playerId],
    enabled: !!playerId,
    queryFn: async (): Promise<MatchRow[]> => {
      if (!playerId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .or(
          `player_a1_id.eq.${playerId},player_a2_id.eq.${playerId},player_b1_id.eq.${playerId},player_b2_id.eq.${playerId}`,
        )
        .order("played_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as MatchRow[];
    },
  });
}
