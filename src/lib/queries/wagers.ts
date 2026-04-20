"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getBettorKey, getNickname } from "@/lib/bettor-identity";
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
};

export type BettorRow = {
  bettor_key: string;
  nickname: string | null;
  balance: number;
  total_won: number;
  total_lost: number;
  bets_placed: number;
  bets_won: number;
  created_at: string;
  updated_at: string;
};

export type WagerRow = {
  id: string;
  proposed_match_id: string;
  bettor_key: string;
  side: "A" | "B";
  stake: number;
  odds: number;
  payout: number | null;
  status: "pending" | "won" | "lost" | "refunded";
  created_at: string;
};

export type ProposedMatchWithPlayers = ProposedMatchRow & {
  team_a_p1_player: Pick<PlayerRow, "id" | "first_name"> | null;
  team_a_p2_player: Pick<PlayerRow, "id" | "first_name"> | null;
  team_b_p1_player: Pick<PlayerRow, "id" | "first_name"> | null;
  team_b_p2_player: Pick<PlayerRow, "id" | "first_name"> | null;
};

export const PROPOSED_KEY = ["proposed-matches"] as const;
export const BETTOR_KEY = ["bettor"] as const;
export const BETTORS_KEY = ["bettors"] as const;

export function useProposedMatches() {
  return useQuery({
    queryKey: PROPOSED_KEY,
    queryFn: async (): Promise<ProposedMatchWithPlayers[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("proposed_matches")
        .select(
          "*, team_a_p1_player:players!proposed_matches_team_a_p1_fkey(id, first_name), team_a_p2_player:players!proposed_matches_team_a_p2_fkey(id, first_name), team_b_p1_player:players!proposed_matches_team_b_p1_fkey(id, first_name), team_b_p2_player:players!proposed_matches_team_b_p2_fkey(id, first_name)",
        )
        .order("created_at", { ascending: false });
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

export function useMe() {
  return useQuery({
    queryKey: BETTOR_KEY,
    queryFn: async (): Promise<BettorRow> => {
      const supabase = createClient();
      const key = getBettorKey();
      const { data } = await supabase
        .from("bettors")
        .select("*")
        .eq("bettor_key", key)
        .maybeSingle();
      if (data) return data as BettorRow;
      // Profil fictif jusqu'au premier pari
      return {
        bettor_key: key,
        nickname: getNickname() || null,
        balance: 1000,
        total_won: 0,
        total_lost: 0,
        bets_placed: 0,
        bets_won: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    },
  });
}

export function useBettors() {
  return useQuery({
    queryKey: BETTORS_KEY,
    queryFn: async (): Promise<BettorRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("bettors")
        .select("*")
        .order("balance", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BettorRow[];
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
      qc.invalidateQueries({ queryKey: BETTOR_KEY });
      qc.invalidateQueries({ queryKey: BETTORS_KEY });
    },
  });
}

export function usePlaceWager(proposedMatchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { side: "A" | "B"; stake: number; nickname?: string }) => {
      const supabase = createClient();
      const { error } = await supabase.rpc("place_wager", {
        p_bettor_key: getBettorKey(),
        p_nickname: input.nickname ?? getNickname() ?? null,
        p_proposed_match_id: proposedMatchId,
        p_side: input.side,
        p_stake: input.stake,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wagers", proposedMatchId] });
      qc.invalidateQueries({ queryKey: BETTOR_KEY });
      qc.invalidateQueries({ queryKey: BETTORS_KEY });
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
      qc.invalidateQueries({ queryKey: BETTOR_KEY });
      qc.invalidateQueries({ queryKey: BETTORS_KEY });
    },
  });
}
