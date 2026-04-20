"use client";

import { useState } from "react";
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
import { ELO_PRESETS, type EloPreset } from "@/lib/elo";
import { useAddPlayer } from "@/lib/queries/players";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PRESET_LABELS: Record<EloPreset, string> = {
  faible: "Faible",
  moyen: "Moyen",
  fort: "Fort",
};

export function AddPlayerDialog() {
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [preset, setPreset] = useState<EloPreset>("moyen");
  const addPlayer = useAddPlayer();

  const reset = () => {
    setFirstName("");
    setPreset("moyen");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) {
      toast.error("Prénom requis.");
      return;
    }
    try {
      await addPlayer.mutateAsync({
        first_name: firstName.trim(),
        elo: ELO_PRESETS[preset],
      });
      toast.success(`${firstName} ajouté.`);
      reset();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'ajout.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="h-4 w-4" />
          Ajouter un joueur
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau joueur</DialogTitle>
          <DialogDescription>Choisissez un niveau de départ. L&apos;Elo évoluera avec les parties.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fn">Prénom</Label>
            <Input id="fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoFocus />
          </div>

          <div className="space-y-2">
            <Label>Niveau de départ</Label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(ELO_PRESETS) as EloPreset[]).map((k) => {
                const active = preset === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setPreset(k)}
                    className={cn(
                      "rounded-xl px-3 py-4 text-center transition-colors",
                      active ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-foreground hover:bg-muted/80",
                    )}
                  >
                    <div className="text-sm font-semibold">{PRESET_LABELS[k]}</div>
                    <div className={cn("text-xs", active ? "opacity-80" : "text-muted-foreground")}>{ELO_PRESETS[k]} Elo</div>
                  </button>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={addPlayer.isPending}>
              {addPlayer.isPending ? "Ajout..." : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
