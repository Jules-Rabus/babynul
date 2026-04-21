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
import { useUpdatePlayerNickname } from "@/lib/queries/players";
import type { PlayerRow } from "@/lib/supabase/types";
import { toast } from "sonner";

type Props = {
  player: PlayerRow | null;
  onClose: () => void;
};

export function EditPlayerDialog({ player, onClose }: Props) {
  const [nickname, setNickname] = useState("");
  const updateNickname = useUpdatePlayerNickname();

  useEffect(() => {
    setNickname(player?.nickname ?? "");
  }, [player]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!player) return;
    try {
      await updateNickname.mutateAsync({
        id: player.id,
        nickname: nickname.trim() || null,
      });
      toast.success("Surnom mis à jour.");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la mise à jour.");
    }
  };

  return (
    <Dialog open={!!player} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier le surnom</DialogTitle>
          <DialogDescription>
            {player && (
              <>Modifier le surnom de <strong>{player.first_name}</strong>. Le prénom reste figé pour ne pas casser l&apos;historique.</>
            )}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-nick">Surnom</Label>
            <Input
              id="edit-nick"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Laissez vide pour retirer le surnom"
              maxLength={40}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={updateNickname.isPending}>
              {updateNickname.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
