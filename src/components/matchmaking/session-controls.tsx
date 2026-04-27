"use client";

import { useState } from "react";
import { Play, Square, Loader2, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useActiveSession, useEndSession, useStartSession } from "@/lib/queries/play-sessions";
import { useAdmin } from "@/components/admin-context";
import { toast } from "sonner";

export function SessionControls() {
  const { unlocked } = useAdmin();
  const { data: active, isLoading } = useActiveSession();
  const startSession = useStartSession();
  const endSession = useEndSession();
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [targetScore, setTargetScore] = useState<number>(10);

  const handleStart = async () => {
    try {
      const now = new Date();
      const label = `Partie du ${now.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })} ${now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
      await startSession.mutateAsync({ label, targetScore });
      toast.success(`Partie démarrée — premier à ${targetScore} pts.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur.");
    }
  };

  const handleEnd = async () => {
    if (!active) return;
    try {
      await endSession.mutateAsync(active.session.id);
      toast.success("Tournoi clôturé.");
      setConfirmEnd(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur.");
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement de la session…
        </CardContent>
      </Card>
    );
  }

  if (!active) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3 py-4">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">Aucune partie en cours</p>
              <p className="text-xs text-muted-foreground">
                Choisis le score cible puis démarre la partie.
              </p>
            </div>
            {unlocked ? (
              <Button
                onClick={handleStart}
                disabled={startSession.isPending}
                size="lg"
                className="w-full sm:w-auto"
              >
                <Play className="h-4 w-4" />
                Démarrer · {targetScore} pts
              </Button>
            ) : (
              <span className="text-xs italic text-muted-foreground">(admin uniquement)</span>
            )}
          </div>
          {unlocked && (
            <div className="flex items-center gap-2 rounded-lg bg-muted/40 p-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Score cible
              </span>
              <div className="ml-auto flex gap-1">
                {[3, 5, 7, 10].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTargetScore(t)}
                    className={cn(
                      "min-h-[36px] min-w-[44px] rounded-md px-2 text-sm font-medium transition-colors",
                      targetScore === t
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-foreground ring-1 ring-border hover:bg-muted",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const started = new Date(active.session.started_at).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">{active.session.label ?? "Partie en cours"}</p>
          <p className="text-xs text-muted-foreground">
            Démarrée à {started} · {active.participants.filter((p) => p.is_present).length} présent
            {active.participants.filter((p) => p.is_present).length > 1 ? "s" : ""} · premier à{" "}
            <strong className="tabular-nums">{active.session.target_score}</strong> pts
          </p>
        </div>
        {unlocked && (
          <Button variant="outline" onClick={() => setConfirmEnd(true)}>
            <Square className="h-4 w-4" />
            Clôturer
          </Button>
        )}
      </CardContent>
      <Dialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clôturer la partie ?</DialogTitle>
            <DialogDescription>
              Les matchs ouverts resteront annulables, et les matchs joués garderont leur lien à la partie pour l&apos;historique.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmEnd(false)}>Annuler</Button>
            <Button onClick={handleEnd} disabled={endSession.isPending}>
              Clôturer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
