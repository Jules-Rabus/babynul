"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { PlaySessionRow, PlayerRow } from "@/lib/supabase/types";

export const ACTIVE_SESSION_KEY = ["play-sessions", "active"] as const;

export type SessionParticipant = {
  player_id: string;
  is_present: boolean;
  joined_at: string;
  left_at: string | null;
  player: Pick<PlayerRow, "id" | "first_name" | "nickname" | "elo" | "games_played"> | null;
};

export type ActiveSession = {
  session: PlaySessionRow;
  participants: SessionParticipant[];
};

export function useActiveSession() {
  return useQuery({
    queryKey: ACTIVE_SESSION_KEY,
    queryFn: async (): Promise<ActiveSession | null> => {
      const supabase = createClient();
      const { data: sessions, error } = await supabase
        .from("play_sessions")
        .select("*")
        .eq("status", "active")
        .order("started_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      const session = sessions?.[0];
      if (!session) return null;

      const { data: participants, error: partErr } = await supabase
        .from("session_players")
        .select(
          "player_id, is_present, joined_at, left_at, player:players(id, first_name, nickname, elo, games_played)",
        )
        .eq("session_id", session.id)
        .order("joined_at", { ascending: true });
      if (partErr) throw partErr;

      return {
        session: session as PlaySessionRow,
        participants: (participants ?? []) as unknown as SessionParticipant[],
      };
    },
  });
}

export function useStartSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { label?: string | null } = {}) => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("start_play_session", {
        p_label: input.label ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["play-sessions"] });
    },
  });
}

export function useEndSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const supabase = createClient();
      const { error } = await supabase.rpc("end_play_session", {
        p_session_id: sessionId,
      });
      if (error) throw error;
    },
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
    }) => {
      const supabase = createClient();
      const { error } = await supabase.rpc("set_session_presence", {
        p_session_id: input.sessionId,
        p_player_id: input.playerId,
        p_present: input.present,
      });
      if (error) throw error;
      // Si le joueur part, on annule ses matchs ouverts dans la session.
      if (!input.present) {
        const { error: cancelErr } = await supabase.rpc(
          "cancel_open_matches_for_session",
          {
            p_session_id: input.sessionId,
            p_involving_player: input.playerId,
          },
        );
        if (cancelErr) throw cancelErr;
      }
    },
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
    mutationFn: async (sessionId: string) => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("cancel_open_matches_for_session", {
        p_session_id: sessionId,
        p_involving_player: null,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proposed-matches"] });
      qc.invalidateQueries({ queryKey: ["players"] });
    },
  });
}
