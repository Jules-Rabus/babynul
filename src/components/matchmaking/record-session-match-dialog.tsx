"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRecordMatch } from "@/lib/queries/matches";
import { useSessionProposedMatches, type ProposedMatchWithPlayers } from "@/lib/queries/wagers";
import { useAnnounceNextMatch, useVoiceEnabled } from "@/lib/voice/use-announce-next-match";
import { displayName } from "@/lib/player-display";
import { fireVictoryEffects } from "@/lib/effects";
import { toast } from "sonner";

type Props = {
  match: ProposedMatchWithPlayers | null;
  sessionId: string | null;
  onClose: () => void;
};

export function RecordSessionMatchDialog({ match, sessionId, onClose }: Props) {
  const [scoreA, setScoreA] = useState("10");
  const [scoreB, setScoreB] = useState("0");
  const record = useRecordMatch();
  const { announce } = useAnnounceNextMatch();
  const voice = useVoiceEnabled();
  const { data: sessionProposed = [] } = useSessionProposedMatches(sessionId);

  useEffect(() => {
    setScoreA("10");
    setScoreB("0");
  }, [match?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!match) return;

    const sA = Number(scoreA);
    const sB = Number(scoreB);
    if (Number.isNaN(sA) || Number.isNaN(sB) || sA < 0 || sB < 0) {
      toast.error("Scores invalides.");
      return;
    }
    if (sA === sB) {
      toast.error("Un vainqueur est requis.");
      return;
    }

    try {
      await record.mutateAsync({
        mode: match.mode,
        a1: match.team_a_p1,
        a2: match.mode === "team" ? match.team_a_p2 : null,
        b1: match.team_b_p1,
        b2: match.mode === "team" ? match.team_b_p2 : null,
        scoreA: sA,
        scoreB: sB,
        sessionId,
        proposedMatchId: match.id,
      });
      toast.success("Match enregistré.");
      void fireVictoryEffects();

      // Trouve le prochain match ouvert (hors celui qu'on vient de fermer).
      if (voice.enabled && sessionId) {
        const next = sessionProposed.find(
          (m) => m.status === "open" && m.id !== match.id,
        );
        if (next) {
          announce({ proposedMatchId: next.id, sessionId }).catch((err) =>
            console.error("[voice] announce failed:", err),
          );
        }
      }

      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur.");
    }
  };

  const teamALabel = match
    ? match.mode === "team"
      ? `${match.team_a_p1_player ? displayName(match.team_a_p1_player) : "?"} & ${match.team_a_p2_player ? displayName(match.team_a_p2_player) : "?"}`
      : match.team_a_p1_player ? displayName(match.team_a_p1_player) : "?"
    : "";

  const teamBLabel = match
    ? match.mode === "team"
      ? `${match.team_b_p1_player ? displayName(match.team_b_p1_player) : "?"} & ${match.team_b_p2_player ? displayName(match.team_b_p2_player) : "?"}`
      : match.team_b_p1_player ? displayName(match.team_b_p1_player) : "?"
    : "";

  return (
    <Dialog open={!!match} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Saisir le score</DialogTitle>
          <DialogDescription>
            {match && (
              <>
                <strong>{teamALabel}</strong> vs <strong>{teamBLabel}</strong>
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="session-score-a">Équipe A — {teamALabel}</Label>
              <Input
                id="session-score-a"
                type="number"
                inputMode="numeric"
                min="0"
                value={scoreA}
                onChange={(e) => setScoreA(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="session-score-b">Équipe B — {teamBLabel}</Label>
              <Input
                id="session-score-b"
                type="number"
                inputMode="numeric"
                min="0"
                value={scoreB}
                onChange={(e) => setScoreB(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={record.isPending}>
              {record.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
