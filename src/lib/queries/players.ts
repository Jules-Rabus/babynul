"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { PlayerRow } from "@/lib/supabase/types";

export const PLAYERS_KEY = ["players"] as const;

export function usePlayers() {
  return useQuery({
    queryKey: PLAYERS_KEY,
    queryFn: async (): Promise<PlayerRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .order("elo", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PlayerRow[];
    },
  });
}

export function useAddPlayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { first_name: string; elo: number; nickname?: string | null }) => {
      const supabase = createClient();
      const nick = input.nickname?.trim() || null;
      const { data, error } = await supabase
        .from("players")
        .insert([{ first_name: input.first_name, elo: input.elo, nickname: nick }])
        .select()
        .single();
      if (error) throw error;
      return data as PlayerRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PLAYERS_KEY }),
  });
}

export function useUpdatePlayerNickname() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; nickname: string | null }) => {
      const supabase = createClient();
      const nick = input.nickname?.trim() || null;
      const { data, error } = await supabase
        .from("players")
        .update({ nickname: nick })
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      return data as PlayerRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PLAYERS_KEY });
      qc.invalidateQueries({ queryKey: ["teams"] });
      qc.invalidateQueries({ queryKey: ["matches"] });
    },
  });
}

export function useDeletePlayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (playerId: string) => {
      const supabase = createClient();
      const { error } = await supabase.rpc("delete_player_cascade", { p_player_id: playerId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PLAYERS_KEY });
      qc.invalidateQueries({ queryKey: ["teams"] });
      qc.invalidateQueries({ queryKey: ["matches"] });
    },
  });
}
