"use client";

import { useState } from "react";
import { Play, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

  const handleStart = async () => {
    try {
      const now = new Date();
      const label = `Partie du ${now.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })} ${now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
      await startSession.mutateAsync({ label });
      toast.success("Partie démarrée.");
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
        <CardContent className="flex flex-col items-start gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Aucune partie en cours</p>
            <p className="text-xs text-muted-foreground">
              Cochez un joueur pour démarrer une partie, ou cliquez ci-contre
              pour en lancer une explicitement.
            </p>
          </div>
          {unlocked ? (
            <Button onClick={handleStart} disabled={startSession.isPending}>
              <Play className="h-4 w-4" />
              Démarrer une partie
            </Button>
          ) : (
            <span className="text-xs italic text-muted-foreground">(admin uniquement)</span>
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
            {active.participants.filter((p) => p.is_present).length > 1 ? "s" : ""}
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
