"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type BetRow = {
  id: string;
  question: string;
  options: string[];
  active: boolean;
  created_at: string;
};

export type BetVoteRow = {
  id: string;
  bet_id: string;
  voter_key: string;
  option_index: number;
  created_at: string;
};

const VOTER_KEY_STORAGE = "babynul-voter-key";

function getVoterKey(): string {
  if (typeof window === "undefined") return "";
  let k = window.localStorage.getItem(VOTER_KEY_STORAGE);
  if (!k) {
    k = crypto.randomUUID();
    window.localStorage.setItem(VOTER_KEY_STORAGE, k);
  }
  return k;
}

export const BETS_KEY = ["bets"] as const;

export function useBets() {
  return useQuery({
    queryKey: BETS_KEY,
    queryFn: async (): Promise<BetRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("bets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BetRow[];
    },
  });
}

export function useBetVotes(betId: string | null) {
  return useQuery({
    queryKey: ["bet-votes", betId],
    enabled: !!betId,
    queryFn: async (): Promise<BetVoteRow[]> => {
      if (!betId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from("bet_votes")
        .select("*")
        .eq("bet_id", betId);
      if (error) throw error;
      return (data ?? []) as BetVoteRow[];
    },
  });
}

export function useCreateBet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { question: string; options: string[] }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("bets")
        .insert([{ question: input.question, options: input.options, active: true }])
        .select()
        .single();
      if (error) throw error;
      return data as BetRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: BETS_KEY }),
  });
}

export function useCloseBet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (betId: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("bets").update({ active: false }).eq("id", betId);
      if (error) throw error;
    },
    onSuccess: (_, betId) => {
      qc.invalidateQueries({ queryKey: BETS_KEY });
      qc.invalidateQueries({ queryKey: ["bet-votes", betId] });
    },
  });
}

export function useDeleteBet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (betId: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("bets").delete().eq("id", betId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: BETS_KEY }),
  });
}

export function useVote(betId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (optionIndex: number) => {
      const supabase = createClient();
      const voter_key = getVoterKey();
      const { error } = await supabase
        .from("bet_votes")
        .upsert(
          [{ bet_id: betId, voter_key, option_index: optionIndex }],
          { onConflict: "bet_id,voter_key" },
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bet-votes", betId] }),
  });
}

export function useMyVote(betId: string) {
  return useQuery({
    queryKey: ["bet-my-vote", betId],
    queryFn: async (): Promise<number | null> => {
      const supabase = createClient();
      const voter_key = getVoterKey();
      if (!voter_key) return null;
      const { data, error } = await supabase
        .from("bet_votes")
        .select("option_index")
        .eq("bet_id", betId)
        .eq("voter_key", voter_key)
        .maybeSingle();
      if (error) throw error;
      return data?.option_index ?? null;
    },
  });
}
