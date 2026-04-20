"use client";

import { useState, useTransition } from "react";
import { Lock, Unlock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAdmin } from "@/components/admin-context";
import { lockAdmin, unlockWithCode } from "@/app/admin-actions";

export function AdminButton() {
  const { unlocked } = useAdmin();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();

  if (unlocked) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          startTransition(async () => {
            await lockAdmin();
            toast.success("Mode admin désactivé.");
          });
        }}
        disabled={pending}
      >
        <Unlock className="h-4 w-4" />
        <span className="hidden sm:inline">Admin</span>
      </Button>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await unlockWithCode(code);
      if (res.ok) {
        toast.success("Mode admin activé.");
        setOpen(false);
        setCode("");
      } else if (res.reason === "not_configured") {
        toast.error("Code admin non configuré côté serveur.");
      } else {
        toast.error("Code invalide.");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Lock className="h-4 w-4" />
          <span className="hidden sm:inline">Débloquer</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Code admin</DialogTitle>
          <DialogDescription>
            Entrez le code pour activer la saisie de matchs et la gestion des joueurs.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="admin-code">Code</Label>
            <Input
              id="admin-code"
              type="password"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="••••••"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Vérification..." : "Valider"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
