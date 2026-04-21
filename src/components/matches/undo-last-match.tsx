"use client";

import { useState } from "react";
import { Undo2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { undoLastMatch } from "@/app/actions/matches";
import { useAdmin } from "@/components/admin-context";
import { toast } from "sonner";

export function UndoLastMatch() {
  const { unlocked } = useAdmin();
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const undo = useMutation({
    mutationFn: async () => {
      await undoLastMatch();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["players"] });
      qc.invalidateQueries({ queryKey: ["teams"] });
      qc.invalidateQueries({ queryKey: ["matches"] });
      toast.success("Dernier match annulé.");
      setOpen(false);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'annulation.");
    },
  });

  if (!unlocked) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Undo2 className="h-4 w-4" />
          Annuler le dernier match
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Annuler le dernier match ?</DialogTitle>
          <DialogDescription>
            Le dernier match enregistré sera supprimé et les Elo / compteurs seront restaurés.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button variant="destructive" onClick={() => undo.mutate()} disabled={undo.isPending}>
            {undo.isPending ? "Annulation..." : "Confirmer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
