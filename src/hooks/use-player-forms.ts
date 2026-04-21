"use client";

import { useMemo } from "react";
import { useSessionMatches, useRecentMatches } from "@/lib/queries/matches";
import { computeFormsFor, type PlayerForm } from "@/lib/voice/player-form";

/**
 * Calcule la forme (GOAT/Roast/Neutral) pour chaque joueur passé.
 * Si `sessionId` est fourni : calcul en scope session. Sinon : 30 derniers jours.
 */
export function usePlayerForms(
  playerIds: string[],
  sessionId: string | null,
): Record<string, PlayerForm> {
  const { data: sessionMatches = [] } = useSessionMatches(sessionId);
  const { data: recent = [] } = useRecentMatches(30);

  const sourceMatches = sessionId ? sessionMatches : recent;

  return useMemo(
    () =>
      computeFormsFor(playerIds, sourceMatches, {
        sessionId: sessionId ?? undefined,
      }),
    [playerIds, sourceMatches, sessionId],
  );
}
