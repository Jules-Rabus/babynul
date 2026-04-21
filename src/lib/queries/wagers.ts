"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { PlayerRow } from "@/lib/supabase/types";

export type ProposedMatchRow = {
  id: string;
  mode: "individual" | "team";
  team_a_p1: string;
  team_a_p2: string | null;
  team_b_p1: string;
  team_b_p2: string | null;
  elo_a: number;
  elo_b: number;
  match_id: string | null;
  status: "open" | "resolved" | "cancelled";
  winner_side: "A" | "B" | null;
  created_at: string;
  resolved_at: string | null;
  session_id: string | null;
};

export type WagerRow = {
  id: string;
  proposed_match_id: string;
  player_id: string;
  side: "A" | "B";
  stake: number;
  odds: number;
  payout: number | null;
  status: "pending" | "won" | "lost" | "refunded";
  created_at: string;
};

export type ProposedMatchWithPlayers = ProposedMatchRow & {
  team_a_p1_player: Pick<PlayerRow, "id" | "first_name" | "nickname"> | null;
  team_a_p2_player: Pick<PlayerRow, "id" | "first_name" | "nickname"> | null;
  team_b_p1_player: Pick<PlayerRow, "id" | "first_name" | "nickname"> | null;
  team_b_p2_player: Pick<PlayerRow, "id" | "first_name" | "nickname"> | null;
};

export const PROPOSED_KEY = ["proposed-matches"] as const;

export function useProposedMatches() {
  return useQuery({
    queryKey: PROPOSED_KEY,
    queryFn: async (): Promise<ProposedMatchWithPlayers[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("proposed_matches")
        .select(
          "*, team_a_p1_player:players!proposed_matches_team_a_p1_fkey(id, first_name, nickname), team_a_p2_player:players!proposed_matches_team_a_p2_fkey(id, first_name, nickname), team_b_p1_player:players!proposed_matches_team_b_p1_fkey(id, first_name, nickname), team_b_p2_player:players!proposed_matches_team_b_p2_fkey(id, first_name, nickname)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown) as ProposedMatchWithPlayers[];
    },
  });
}

export function useSessionProposedMatches(sessionId: string | null) {
  return useQuery({
    queryKey: ["proposed-matches", "session", sessionId],
    enabled: !!sessionId,
    queryFn: async (): Promise<ProposedMatchWithPlayers[]> => {
      if (!sessionId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from("proposed_matches")
        .select(
          "*, team_a_p1_player:players!proposed_matches_team_a_p1_fkey(id, first_name, nickname), team_a_p2_player:players!proposed_matches_team_a_p2_fkey(id, first_name, nickname), team_b_p1_player:players!proposed_matches_team_b_p1_fkey(id, first_name, nickname), team_b_p2_player:players!proposed_matches_team_b_p2_fkey(id, first_name, nickname)",
        )
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as unknown) as ProposedMatchWithPlayers[];
    },
  });
}

export function useWagers(proposedMatchId: string | null) {
  return useQuery({
    queryKey: ["wagers", proposedMatchId],
    enabled: !!proposedMatchId,
    queryFn: async (): Promise<WagerRow[]> => {
      if (!proposedMatchId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from("wagers")
        .select("*")
        .eq("proposed_match_id", proposedMatchId);
      if (error) throw error;
      return (data ?? []) as WagerRow[];
    },
  });
}

export function useCreateProposedMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      mode: "individual" | "team";
      team_a_p1: string;
      team_a_p2: string | null;
      team_b_p1: string;
      team_b_p2: string | null;
      elo_a: number;
      elo_b: number;
      session_id?: string | null;
    }) => {
      const supabase = createClient();
      const { error } = await supabase.from("proposed_matches").insert([input]);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PROPOSED_KEY }),
  });
}

export function useCancelProposedMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (proposedMatchId: string) => {
      const supabase = createClient();
      const { error } = await supabase.rpc("cancel_proposed_match", {
        p_proposed_match_id: proposedMatchId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROPOSED_KEY });
      qc.invalidateQueries({ queryKey: ["players"] });
    },
  });
}

export function usePlaceWager(proposedMatchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { playerId: string; side: "A" | "B"; stake: number }) => {
      const supabase = createClient();
      const { error } = await supabase.rpc("place_wager", {
        p_player_id: input.playerId,
        p_proposed_match_id: proposedMatchId,
        p_side: input.side,
        p_stake: input.stake,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wagers", proposedMatchId] });
      qc.invalidateQueries({ queryKey: ["players"] });
    },
  });
}

export function useResolveProposedMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { proposedMatchId: string; winnerSide: "A" | "B"; matchId?: string }) => {
      const supabase = createClient();
      const { error } = await supabase.rpc("resolve_proposed_match", {
        p_proposed_match_id: input.proposedMatchId,
        p_winner_side: input.winnerSide,
        p_match_id: input.matchId ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROPOSED_KEY });
      qc.invalidateQueries({ queryKey: ["players"] });
    },
  });
}
