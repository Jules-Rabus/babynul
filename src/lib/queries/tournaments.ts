"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import type { TournamentRow, TournamentWithGraph } from "@/lib/db/types";
import {
  createTournament,
  endTournament,
  recordTournamentMatch,
} from "@/app/actions/tournaments";
import type {
  CreateTournamentInput,
  RecordTournamentMatchInput,
} from "@/lib/schemas";

export const TOURNAMENTS_KEY = ["tournaments"] as const;

export function useTournaments(params: { status?: "active" | "ended"; date?: "today" } = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.date) qs.set("date", params.date);
  const url = `/api/tournaments${qs.toString() ? `?${qs}` : ""}`;
  return useQuery({
    queryKey: [...TOURNAMENTS_KEY, params],
    queryFn: () => apiGet<TournamentRow[]>(url),
  });
}

export function useTournament(id: string | null) {
  return useQuery({
    queryKey: [...TOURNAMENTS_KEY, "detail", id],
    enabled: !!id,
    queryFn: () => apiGet<TournamentWithGraph>(`/api/tournaments/${id}`),
  });
}

export function useCreateTournament() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTournamentInput) => createTournament(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TOURNAMENTS_KEY });
    },
  });
}

export function useRecordTournamentMatch(tournamentId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RecordTournamentMatchInput) => recordTournamentMatch(input),
    onSuccess: () => {
      if (tournamentId) {
        qc.invalidateQueries({ queryKey: [...TOURNAMENTS_KEY, "detail", tournamentId] });
      }
      qc.invalidateQueries({ queryKey: TOURNAMENTS_KEY });
      qc.invalidateQueries({ queryKey: ["players"] });
      qc.invalidateQueries({ queryKey: ["teams"] });
      qc.invalidateQueries({ queryKey: ["matches"] });
    },
  });
}

export function useEndTournament() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tournamentId: string) => endTournament({ tournamentId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TOURNAMENTS_KEY });
    },
  });
}
