"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MatchRow } from "@/lib/db/types";
import { apiGet } from "@/lib/api-client";
import { recordMatch, editMatchScore } from "@/app/actions/matches";

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
    mutationFn: async (input: RecordMatchInput) => recordMatch(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MATCHES_KEY });
      qc.invalidateQueries({ queryKey: ["players"] });
      qc.invalidateQueries({ queryKey: ["teams"] });
      qc.invalidateQueries({ queryKey: ["proposed-matches"] });
      qc.invalidateQueries({ queryKey: ["play-sessions"] });
    },
  });
}

export function useEditMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      matchId: string;
      scoreA: number;
      scoreB: number;
    }) => editMatchScore(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MATCHES_KEY });
      qc.invalidateQueries({ queryKey: ["players"] });
      qc.invalidateQueries({ queryKey: ["teams"] });
      qc.invalidateQueries({ queryKey: ["proposed-matches"] });
      qc.invalidateQueries({ queryKey: ["play-sessions"] });
    },
  });
}

export function useRecentMatches(days = 30) {
  return useQuery({
    queryKey: ["matches", "recent", days],
    queryFn: () => apiGet<MatchRow[]>(`/api/matches?scope=recent&days=${days}`),
  });
}

export function usePlayerMatches(playerId: string | null) {
  return useQuery({
    queryKey: ["matches", "player", playerId],
    enabled: !!playerId,
    queryFn: () =>
      apiGet<MatchRow[]>(`/api/matches?scope=player&playerId=${playerId}&limit=500`),
  });
}

export function useSessionMatches(sessionId: string | null) {
  return useQuery({
    queryKey: ["matches", "session", sessionId],
    enabled: !!sessionId,
    queryFn: () =>
      apiGet<MatchRow[]>(`/api/matches?scope=session&sessionId=${sessionId}`),
  });
}
