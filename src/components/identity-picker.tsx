"use client";

import { UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useCurrentPlayer } from "@/hooks/use-current-player";
import { usePlayers } from "@/lib/queries/players";
import { useState } from "react";
import { cn, initials } from "@/lib/utils";
import { displayName } from "@/lib/player-display";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function IdentityPicker() {
  const { me, setMe, mounted } = useCurrentPlayer();
  const { data: players = [] } = usePlayers();
  const [open, setOpen] = useState(false);

  if (!mounted) return <div className="h-10 w-28 animate-pulse rounded-md bg-muted" />;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserCircle className="h-4 w-4" />
          <span className="hidden sm:inline">{me ? displayName(me) : "Qui êtes-vous ?"}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Choisir votre profil</DialogTitle>
          <DialogDescription>
            Sélectionnez votre prénom pour parier et suivre votre solde.
          </DialogDescription>
        </DialogHeader>
        <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto">
          {players.map((p) => {
            const active = me?.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setMe(p.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center gap-2 rounded-xl p-2 text-left transition-colors",
                  active ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70",
                )}
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback
                    className={cn(active && "bg-primary-foreground text-primary")}
                  >
                    {initials(p.first_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate text-sm font-medium">{displayName(p)}</span>
              </button>
            );
          })}
          {players.length === 0 && (
            <p className="col-span-2 py-6 text-center text-sm text-muted-foreground">
              Aucun joueur. Un admin doit en ajouter dans l&apos;onglet Joueurs.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
