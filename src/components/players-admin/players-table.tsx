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
import { Trash2 } from "lucide-react";
import { useDeletePlayer, usePlayers } from "@/lib/queries/players";
import { AddPlayerDialog } from "./add-player-dialog";
import { SortHeader, type SortDir } from "@/components/ranking/sort-header";
import { fullName, initials } from "@/lib/utils";
import type { PlayerRow } from "@/lib/supabase/types";
import { useSession } from "@/hooks/use-session";
import { toast } from "sonner";

type SortCol = "name" | "games" | "elo";

export function PlayersTable() {
  const { user } = useSession();
  const { data: players = [], isLoading } = usePlayers();
  const deletePlayer = useDeletePlayer();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortCol>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [toDelete, setToDelete] = useState<PlayerRow | null>(null);

  const displayed = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sign = sortDir === "asc" ? 1 : -1;
    return players
      .filter((p) => (q ? fullName(p.first_name, p.last_name).toLowerCase().includes(q) : true))
      .sort((a, b) => {
        switch (sortBy) {
          case "name":
            return (
              sign *
              fullName(a.first_name, a.last_name).localeCompare(fullName(b.first_name, b.last_name), "fr")
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
      toast.success(`${fullName(toDelete.first_name, toDelete.last_name)} supprimé.`);
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
          {user && <AddPlayerDialog />}
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
                          <AvatarFallback>{initials(p.first_name, p.last_name)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{fullName(p.first_name, p.last_name)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {p.games_played}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{p.elo}</TableCell>
                    <TableCell>
                      {user && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setToDelete(p)}
                          aria-label={`Supprimer ${fullName(p.first_name, p.last_name)}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer ce joueur ?</DialogTitle>
            <DialogDescription>
              {toDelete && (
                <>
                  <strong>{fullName(toDelete.first_name, toDelete.last_name)}</strong> sera supprimé
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
