"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RealtimeEvent } from "@/lib/realtime/events";

export function useRealtimeInvalidator() {
  const qc = useQueryClient();

  useEffect(() => {
    // SSR ou env sans EventSource → skip.
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;

    const es = new EventSource("/api/events");

    es.onmessage = (ev) => {
      let data: RealtimeEvent;
      try {
        data = JSON.parse(ev.data) as RealtimeEvent;
      } catch {
        return;
      }
      switch (data.type) {
        case "proposed-match:created":
        case "proposed-match:cancelled":
          qc.invalidateQueries({ queryKey: ["proposed-matches"] });
          break;
        case "match:recorded":
          qc.invalidateQueries({ queryKey: ["matches"] });
          qc.invalidateQueries({ queryKey: ["proposed-matches"] });
          qc.invalidateQueries({ queryKey: ["players"] });
          qc.invalidateQueries({ queryKey: ["teams"] });
          qc.invalidateQueries({ queryKey: ["play-sessions"] });
          break;
        case "session:presence-changed":
        case "session:started":
        case "session:ended":
          qc.invalidateQueries({ queryKey: ["play-sessions"] });
          qc.invalidateQueries({ queryKey: ["proposed-matches"] });
          break;
        case "wager:changed":
          qc.invalidateQueries({ queryKey: ["wagers", data.proposedMatchId] });
          qc.invalidateQueries({ queryKey: ["players"] });
          break;
        case "tournament:created":
        case "tournament:match-recorded":
        case "tournament:ended":
          qc.invalidateQueries({ queryKey: ["tournaments"] });
          qc.invalidateQueries({ queryKey: ["players"] });
          qc.invalidateQueries({ queryKey: ["teams"] });
          qc.invalidateQueries({ queryKey: ["matches"] });
          break;
      }
    };

    es.onerror = () => {
      // EventSource gère le retry automatique — on log juste pour debug.
      console.debug("[realtime] EventSource error, browser will retry");
    };

    return () => {
      es.close();
    };
  }, [qc]);
}
