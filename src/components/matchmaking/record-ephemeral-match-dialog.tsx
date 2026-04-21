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
import { displayName } from "@/lib/player-display";
import { fireVictoryEffects } from "@/lib/effects";
import type { ProposedMatch } from "@/lib/matchmaking";
import { toast } from "sonner";

type Props = {
  match: ProposedMatch | null;
  onClose: () => void;
  onRecorded?: () => void;
};

export function RecordEphemeralMatchDialog({ match, onClose, onRecorded }: Props) {
  const [scoreA, setScoreA] = useState("10");
  const [scoreB, setScoreB] = useState("0");
  const record = useRecordMatch();

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
    const [a1, a2] = match.teamA.players;
    const [b1, b2] = match.teamB.players;
    try {
      await record.mutateAsync({
        mode: "team",
        a1: a1.id,
        a2: a2.id,
        b1: b1.id,
        b2: b2.id,
        scoreA: sA,
        scoreB: sB,
      });
      toast.success("Match enregistré.");
      void fireVictoryEffects();
      onRecorded?.();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur.");
    }
  };

  const teamALabel = match
    ? `${displayName(match.teamA.players[0])} & ${displayName(match.teamA.players[1])}`
    : "";
  const teamBLabel = match
    ? `${displayName(match.teamB.players[0])} & ${displayName(match.teamB.players[1])}`
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
              <Label htmlFor="eph-score-a">Équipe A</Label>
              <Input
                id="eph-score-a"
                type="number"
                inputMode="numeric"
                min="0"
                value={scoreA}
                onChange={(e) => setScoreA(e.target.value)}
                autoFocus
                className="h-11 text-lg tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eph-score-b">Équipe B</Label>
              <Input
                id="eph-score-b"
                type="number"
                inputMode="numeric"
                min="0"
                value={scoreB}
                onChange={(e) => setScoreB(e.target.value)}
                className="h-11 text-lg tabular-nums"
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
