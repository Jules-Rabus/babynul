"use client";

import { useQuery } from "@tanstack/react-query";
import type { TeamRow, PlayerRow } from "@/lib/db/types";
import { apiGet } from "@/lib/api-client";

export type TeamWithPlayers = TeamRow & {
  player1: Pick<PlayerRow, "id" | "first_name" | "nickname"> | null;
  player2: Pick<PlayerRow, "id" | "first_name" | "nickname"> | null;
};

export const TEAMS_KEY = ["teams"] as const;

export function useTeams() {
  return useQuery({
    queryKey: TEAMS_KEY,
    queryFn: () => apiGet<TeamWithPlayers[]>("/api/teams"),
  });
}
