"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PlayerRow } from "@/lib/db/types";
import { apiGet } from "@/lib/api-client";
import {
  addPlayer,
  updatePlayerNickname,
  deletePlayerCascade,
} from "@/app/actions/players";

export const PLAYERS_KEY = ["players"] as const;

export function usePlayers() {
  return useQuery({
    queryKey: PLAYERS_KEY,
    queryFn: () => apiGet<PlayerRow[]>("/api/players"),
  });
}

export function useAddPlayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      first_name: string;
      elo: number;
      nickname?: string | null;
    }) => addPlayer(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: PLAYERS_KEY }),
  });
}

export function useUpdatePlayerNickname() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; nickname: string | null }) =>
      updatePlayerNickname(input),
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
    mutationFn: async (playerId: string) => deletePlayerCascade({ id: playerId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PLAYERS_KEY });
      qc.invalidateQueries({ queryKey: ["teams"] });
      qc.invalidateQueries({ queryKey: ["matches"] });
    },
  });
}
