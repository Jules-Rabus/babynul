"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PlaySessionRow, PlayerRow } from "@/lib/db/types";
import { apiGet } from "@/lib/api-client";
import {
  startSession,
  endSession,
  setSessionPresence,
  cancelOpenSessionMatches,
} from "@/app/actions/sessions";

export const ACTIVE_SESSION_KEY = ["play-sessions", "active"] as const;

export type SessionParticipant = {
  player_id: string;
  is_present: boolean;
  joined_at: string;
  left_at: string | null;
  player: Pick<
    PlayerRow,
    "id" | "first_name" | "nickname" | "elo" | "games_played"
  > | null;
};

export type ActiveSession = {
  session: PlaySessionRow;
  participants: SessionParticipant[];
};

export function useActiveSession() {
  return useQuery({
    queryKey: ACTIVE_SESSION_KEY,
    queryFn: () => apiGet<ActiveSession | null>("/api/sessions/active"),
  });
}

export type SessionListItem = PlaySessionRow & { match_count: number };

export function useSessions(params: { status?: "active" | "ended"; date?: "today" } = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.date) qs.set("date", params.date);
  const url = `/api/sessions${qs.toString() ? `?${qs}` : ""}`;
  return useQuery({
    queryKey: ["play-sessions", params],
    queryFn: () => apiGet<SessionListItem[]>(url),
  });
}

export function useStartSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: { label?: string | null; targetScore?: number } = {},
    ) => startSession(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["play-sessions"] });
    },
  });
}

export function useEndSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) =>
      endSession({ sessionId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["play-sessions"] });
      qc.invalidateQueries({ queryKey: ["proposed-matches"] });
    },
  });
}

export function useSessionPresence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      sessionId: string;
      playerId: string;
      present: boolean;
    }) => setSessionPresence(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["play-sessions"] });
      qc.invalidateQueries({ queryKey: ["proposed-matches"] });
      qc.invalidateQueries({ queryKey: ["players"] });
    },
  });
}

export function useCancelOpenSessionMatches() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) =>
      cancelOpenSessionMatches({ sessionId, involvingPlayer: null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proposed-matches"] });
      qc.invalidateQueries({ queryKey: ["players"] });
    },
  });
}
