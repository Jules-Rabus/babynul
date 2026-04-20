"use client";

import { useEffect, useState, useCallback } from "react";
import { clearCurrentPlayerId, getCurrentPlayerId, setCurrentPlayerId } from "@/lib/current-player";
import { usePlayers } from "@/lib/queries/players";
import type { PlayerRow } from "@/lib/supabase/types";

export function useCurrentPlayer() {
  const [id, setId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const { data: players = [] } = usePlayers();

  useEffect(() => {
    setId(getCurrentPlayerId());
    setMounted(true);
  }, []);

  const setMe = useCallback((playerId: string) => {
    setCurrentPlayerId(playerId);
    setId(playerId);
  }, []);

  const clearMe = useCallback(() => {
    clearCurrentPlayerId();
    setId(null);
  }, []);

  // Vérifier que le joueur existe toujours dans la liste
  const me: PlayerRow | null = id ? (players.find((p) => p.id === id) ?? null) : null;

  return { me, id: me?.id ?? null, setMe, clearMe, mounted };
}
