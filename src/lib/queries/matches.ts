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
  sessionId?: string | null;
  proposedMatchId?: string | null;
};

export function useRecordMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RecordMatchInput) => {
      const supabase = createClient();
      // Si une session est fournie, on utilise record_match_v2 qui taggue session_id.
      const rpcName = input.sessionId ? "record_match_v2" : "record_match";
      const args: Record<string, unknown> = {
        p_mode: input.mode,
        p_a1: input.a1,
        p_a2: input.a2,
        p_b1: input.b1,
        p_b2: input.b2,
        p_score_a: input.scoreA,
        p_score_b: input.scoreB,
      };
      if (input.sessionId) args.p_session_id = input.sessionId;
      const { data, error } = await supabase.rpc(rpcName, args);
      if (error) throw error;
      const matchId = data as string;

      // Si on a un proposed_match lié, on le résout automatiquement côté vainqueur.
      if (input.proposedMatchId) {
        const winnerSide = input.scoreA > input.scoreB ? "A" : "B";
        const { error: resolveErr } = await supabase.rpc("resolve_proposed_match", {
          p_proposed_match_id: input.proposedMatchId,
          p_winner_side: winnerSide,
          p_match_id: matchId,
        });
        if (resolveErr) throw resolveErr;
      }
      return matchId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MATCHES_KEY });
      qc.invalidateQueries({ queryKey: ["players"] });
      qc.invalidateQueries({ queryKey: ["teams"] });
      qc.invalidateQueries({ queryKey: ["proposed-matches"] });
      qc.invalidateQueries({ queryKey: ["play-sessions"] });
    },
  });
}

export function useSessionMatches(sessionId: string | null) {
  return useQuery({
    queryKey: ["matches", "session", sessionId],
    enabled: !!sessionId,
    queryFn: async (): Promise<MatchRow[]> => {
      if (!sessionId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .eq("session_id", sessionId)
        .order("played_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MatchRow[];
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
