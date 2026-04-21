"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PlayerRow } from "@/lib/db/types";
import { apiGet } from "@/lib/api-client";
import {
  createProposedMatch,
  cancelProposedMatch,
  resolveProposedMatch,
} from "@/app/actions/proposed-matches";
import { placeWager } from "@/app/actions/wagers";

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
    queryFn: () => apiGet<ProposedMatchWithPlayers[]>("/api/proposed-matches"),
  });
}

export function useSessionProposedMatches(sessionId: string | null) {
  return useQuery({
    queryKey: ["proposed-matches", "session", sessionId],
    enabled: !!sessionId,
    queryFn: () =>
      apiGet<ProposedMatchWithPlayers[]>(
        `/api/proposed-matches?sessionId=${sessionId}`,
      ),
  });
}

export function useWagers(proposedMatchId: string | null) {
  return useQuery({
    queryKey: ["wagers", proposedMatchId],
    enabled: !!proposedMatchId,
    queryFn: () =>
      apiGet<WagerRow[]>(`/api/wagers?proposedMatchId=${proposedMatchId}`),
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
    }) => createProposedMatch(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROPOSED_KEY }),
  });
}

export function useCancelProposedMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (proposedMatchId: string) =>
      cancelProposedMatch({ proposedMatchId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROPOSED_KEY });
      qc.invalidateQueries({ queryKey: ["players"] });
    },
  });
}

export function usePlaceWager(proposedMatchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      playerId: string;
      side: "A" | "B";
      stake: number;
    }) =>
      placeWager({
        playerId: input.playerId,
        proposedMatchId,
        side: input.side,
        stake: input.stake,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wagers", proposedMatchId] });
      qc.invalidateQueries({ queryKey: ["players"] });
    },
  });
}

export function useResolveProposedMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      proposedMatchId: string;
      winnerSide: "A" | "B";
      matchId?: string | null;
    }) => resolveProposedMatch(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROPOSED_KEY });
      qc.invalidateQueries({ queryKey: ["players"] });
    },
  });
}
