"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { usePlayers } from "@/lib/queries/players";
import { SortHeader, type SortDir } from "./sort-header";
import { Medal } from "./medal";
import { PlayerModal } from "./player-modal";
import { fullName, initials } from "@/lib/utils";
import type { PlayerRow } from "@/lib/supabase/types";

type SortCol = "rank" | "name" | "games" | "elo";

export function PlayersRanking() {
  const { data: players = [], isLoading } = usePlayers();
  const [sortBy, setSortBy] = useState<SortCol>("elo");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<PlayerRow | null>(null);

  // Rang global figé basé sur Elo brut, indépendant du tri courant
  const globalRank = useMemo(() => {
    const sorted = [...players].sort((a, b) => b.elo - a.elo);
    const map = new Map<string, number>();
    sorted.forEach((p, i) => map.set(p.id, i + 1));
    return map;
  }, [players]);

  const displayed = useMemo(() => {
    const sign = sortDir === "asc" ? 1 : -1;
    const arr = [...players];
    arr.sort((a, b) => {
      switch (sortBy) {
        case "rank":
          return sign * ((globalRank.get(a.id) ?? 0) - (globalRank.get(b.id) ?? 0));
        case "name":
          return sign * fullName(a.first_name, a.last_name).localeCompare(fullName(b.first_name, b.last_name), "fr");
        case "games":
          return sign * (a.games_played - b.games_played);
        case "elo":
        default:
          return sign * (a.elo - b.elo);
      }
    });
    return arr;
  }, [players, sortBy, sortDir, globalRank]);

  const handleSort = (col: SortCol) => {
    if (col === sortBy) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(col);
      setSortDir(col === "name" ? "asc" : "desc");
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Classement — Individuel</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <RankingSkeleton />
          ) : players.length === 0 ? (
            <EmptyState message="Aucun joueur pour l'instant." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">
                    <SortHeader label="Rang" column="rank" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  </TableHead>
                  <TableHead>
                    <SortHeader label="Joueur" column="name" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortHeader
                      label="Parties"
                      column="games"
                      sortBy={sortBy}
                      sortDir={sortDir}
                      onSort={handleSort}
                      align="right"
                    />
                  </TableHead>
                  <TableHead className="w-24 text-right">
                    <SortHeader
                      label="Elo"
                      column="elo"
                      sortBy={sortBy}
                      sortDir={sortDir}
                      onSort={handleSort}
                      align="right"
                    />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayed.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer"
                    onClick={() => setSelected(p)}
                  >
                    <TableCell>
                      <Medal rank={globalRank.get(p.id) ?? 0} />
                    </TableCell>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <PlayerModal player={selected} open={!!selected} onOpenChange={(o) => !o && setSelected(null)} />
    </>
  );
}

function RankingSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{message}</p>;
}
