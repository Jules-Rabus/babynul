"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "babynul-voice-enabled";

export function useVoiceEnabled() {
  const [enabled, setEnabled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      setEnabled(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* no-op */
    }
  }, []);

  const toggle = useCallback(() => {
    setEnabled((v) => {
      const next = !v;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* no-op */
      }
      return next;
    });
  }, []);

  return { enabled, toggle, mounted };
}

export function useAnnounceNextMatch() {
  const [loading, setLoading] = useState(false);

  const announce = useCallback(
    async (input: { proposedMatchId: string; sessionId?: string | null }) => {
      setLoading(true);
      try {
        const res = await fetch("/api/voice/announce", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(txt || `voice ${res.status}`);
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.addEventListener("ended", () => URL.revokeObjectURL(url));
        await audio.play();
        return audio;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { announce, loading };
}
