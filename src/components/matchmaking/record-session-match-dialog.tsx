"use client";

import { useEffect, useState } from "react";
import { Volume2 } from "lucide-react";
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

function labelFor(match: ProposedMatchWithPlayers, side: "A" | "B"): string {
  const fmt = (p: { first_name: string; nickname?: string | null } | null | undefined) =>
    p ? displayName(p) : "?";
  if (side === "A") {
    if (match.mode === "individual") return fmt(match.team_a_p1_player);
    return `${fmt(match.team_a_p1_player)} & ${fmt(match.team_a_p2_player)}`;
  }
  if (match.mode === "individual") return fmt(match.team_b_p1_player);
  return `${fmt(match.team_b_p1_player)} & ${fmt(match.team_b_p2_player)}`;
}

export function RecordSessionMatchDialog({ match, sessionId, onClose }: Props) {
  const [scoreA, setScoreA] = useState("10");
  const [scoreB, setScoreB] = useState("0");
  const [phase, setPhase] = useState<"input" | "after">("input");
  const record = useRecordMatch();
  const { announce, loading: announceLoading } = useAnnounceNextMatch();
  const voice = useVoiceEnabled();
  const { data: sessionProposed = [] } = useSessionProposedMatches(sessionId);

  useEffect(() => {
    setScoreA("10");
    setScoreB("0");
    setPhase("input");
  }, [match?.id]);

  // Cherche le prochain match ouvert différent de celui qu'on vient de saisir.
  const nextMatch = match
    ? sessionProposed.find((m) => m.status === "open" && m.id !== match.id)
    : undefined;

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
      setPhase("after");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur.");
    }
  };

  const handleAnnounce = async () => {
    if (!nextMatch || !sessionId) {
      onClose();
      return;
    }
    try {
      await announce({ proposedMatchId: nextMatch.id, sessionId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur voice.");
    } finally {
      onClose();
    }
  };

  const teamALabel = match ? labelFor(match, "A") : "";
  const teamBLabel = match ? labelFor(match, "B") : "";

  const showAnnounce = phase === "after" && voice.enabled && !!nextMatch;

  return (
    <Dialog open={!!match} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{phase === "input" ? "Saisir le score" : "Match enregistré"}</DialogTitle>
          <DialogDescription>
            {match && phase === "input" && (
              <>
                <strong>{teamALabel}</strong> vs <strong>{teamBLabel}</strong>
              </>
            )}
            {phase === "after" && nextMatch && (
              <>
                Prochain match :{" "}
                <strong>{labelFor(nextMatch, "A")}</strong> vs{" "}
                <strong>{labelFor(nextMatch, "B")}</strong>
              </>
            )}
            {phase === "after" && !nextMatch && (
              <>Aucun autre match ouvert pour le moment.</>
            )}
          </DialogDescription>
        </DialogHeader>

        {phase === "input" && (
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
        )}

        {phase === "after" && (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Fermer
            </Button>
            {showAnnounce && (
              <Button type="button" onClick={handleAnnounce} disabled={announceLoading}>
                <Volume2 className="h-4 w-4" />
                {announceLoading ? "Annonce..." : "Annoncer le prochain match"}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
