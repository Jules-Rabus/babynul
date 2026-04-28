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
import { ScoreStepper } from "@/components/ui/score-stepper";
import { useEditMatch } from "@/lib/queries/matches";
import { toast } from "sonner";

type Props = {
  open: boolean;
  matchId: string | null;
  teamALabel: string;
  teamBLabel: string;
  initialScoreA: number;
  initialScoreB: number;
  onClose: () => void;
};

export function EditMatchDialog({
  open,
  matchId,
  teamALabel,
  teamBLabel,
  initialScoreA,
  initialScoreB,
  onClose,
}: Props) {
  const [scoreA, setScoreA] = useState<number>(initialScoreA);
  const [scoreB, setScoreB] = useState<number>(initialScoreB);
  const editMatch = useEditMatch();

  useEffect(() => {
    if (open) {
      setScoreA(initialScoreA);
      setScoreB(initialScoreB);
    }
  }, [open, initialScoreA, initialScoreB]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchId) return;
    if (scoreA < 0 || scoreB < 0) {
      toast.error("Scores invalides.");
      return;
    }
    if (scoreA === scoreB) {
      toast.error("Un vainqueur est requis.");
      return;
    }
    try {
      await editMatch.mutateAsync({ matchId, scoreA, scoreB });
      toast.success("Match modifié — Elo recalculé.");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Corriger le score</DialogTitle>
          <DialogDescription>
            <strong>{teamALabel}</strong> vs <strong>{teamBLabel}</strong>
            <br />
            L&apos;Elo des joueurs et équipes sera recalculé en conséquence.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <ScoreStepper
              id="edit-score-a"
              label={`A · ${teamALabel}`}
              value={scoreA}
              onChange={setScoreA}
              max={30}
            />
            <ScoreStepper
              id="edit-score-b"
              label={`B · ${teamBLabel}`}
              value={scoreB}
              onChange={setScoreB}
              max={30}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={editMatch.isPending || !matchId}>
              {editMatch.isPending ? "Mise à jour..." : "Recalculer l'Elo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
