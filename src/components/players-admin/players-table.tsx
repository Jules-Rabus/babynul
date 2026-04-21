"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Trash2 } from "lucide-react";
import { useDeletePlayer, usePlayers } from "@/lib/queries/players";
import { AddPlayerDialog } from "./add-player-dialog";
import { EditPlayerDialog } from "./edit-player-dialog";
import { SortHeader, type SortDir } from "@/components/ranking/sort-header";
import { initials } from "@/lib/utils";
import { displayName } from "@/lib/player-display";
import type { PlayerRow } from "@/lib/supabase/types";
import { useAdmin } from "@/components/admin-context";
import { toast } from "sonner";

type SortCol = "name" | "games" | "elo";

export function PlayersTable() {
  const { unlocked } = useAdmin();
  const { data: players = [], isLoading } = usePlayers();
  const deletePlayer = useDeletePlayer();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortCol>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [toDelete, setToDelete] = useState<PlayerRow | null>(null);
  const [toEdit, setToEdit] = useState<PlayerRow | null>(null);

  const displayed = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sign = sortDir === "asc" ? 1 : -1;
    return players
      .filter((p) => {
        if (!q) return true;
        return (
          p.first_name.toLowerCase().includes(q) ||
          (p.nickname ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "name":
            return (
              sign *
              a.first_name.localeCompare(b.first_name, "fr")
            );
          case "games":
            return sign * (a.games_played - b.games_played);
          case "elo":
          default:
            return sign * (a.elo - b.elo);
        }
      });
  }, [players, search, sortBy, sortDir]);

  const handleSort = (col: SortCol) => {
    if (col === sortBy) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(col);
      setSortDir(col === "name" ? "asc" : "desc");
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await deletePlayer.mutateAsync(toDelete.id);
      toast.success(`${toDelete.first_name} supprimé.`);
      setToDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la suppression.");
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Joueurs</CardTitle>
            <CardDescription>Gestion complète (ajouter, rechercher, supprimer).</CardDescription>
          </div>
          {unlocked && <AddPlayerDialog />}
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Rechercher un joueur..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : displayed.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Aucun joueur.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <SortHeader label="Identité" column="name" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortHeader label="Parties jouées" column="games" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} align="right" />
                  </TableHead>
                  <TableHead className="w-24 text-right">
                    <SortHeader label="Elo" column="elo" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} align="right" />
                  </TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayed.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback>{initials(p.first_name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium">{p.first_name}</span>
                          {p.nickname && (
                            <span className="text-xs text-muted-foreground">« {p.nickname} »</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {p.games_played}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{p.elo}</TableCell>
                    <TableCell>
                      {unlocked && (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setToEdit(p)}
                            aria-label={`Modifier le surnom de ${p.first_name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setToDelete(p)}
                            aria-label={`Supprimer ${displayName(p)}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <EditPlayerDialog player={toEdit} onClose={() => setToEdit(null)} />

      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer ce joueur ?</DialogTitle>
            <DialogDescription>
              {toDelete && (
                <>
                  <strong>{toDelete.first_name}</strong> sera supprimé
                  définitivement, ainsi que toutes ses équipes et tous les matchs auxquels il a participé.
                  Cette action est irréversible.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deletePlayer.isPending}>
              {deletePlayer.isPending ? "Suppression..." : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
