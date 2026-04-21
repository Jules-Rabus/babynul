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
      const today = new Date().toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
      await startSession.mutateAsync({ label: `Soirée du ${today}` });
      toast.success("Soirée démarrée.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur.");
    }
  };

  const handleEnd = async () => {
    if (!active) return;
    try {
      await endSession.mutateAsync(active.session.id);
      toast.success("Soirée clôturée.");
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
            <p className="text-sm font-semibold">Aucune soirée en cours</p>
            <p className="text-xs text-muted-foreground">
              Démarrez une soirée pour persister les matchs, compter qui joue le moins, et tout recaler si quelqu&apos;un part.
            </p>
          </div>
          {unlocked ? (
            <Button onClick={handleStart} disabled={startSession.isPending}>
              <Play className="h-4 w-4" />
              Démarrer la soirée
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
          <p className="text-sm font-semibold">{active.session.label ?? "Soirée en cours"}</p>
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
            <DialogTitle>Clôturer la soirée ?</DialogTitle>
            <DialogDescription>
              Les matchs ouverts resteront annulables, et les matchs joués garderont leur lien à la session pour l&apos;historique.
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
