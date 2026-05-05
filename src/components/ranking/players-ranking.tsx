"use client";

import { useMemo, useState } from "react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { usePlayers } from "@/lib/queries/players";
import { useRecentMatches } from "@/lib/queries/matches";
import { aggregatePlayersForDay, listMatchDays } from "@/lib/daily-elo";
import { SortHeader, type SortDir } from "./sort-header";
import { Medal } from "./medal";
import { PlayerModal } from "./player-modal";
import { cn, initials } from "@/lib/utils";
import { displayName } from "@/lib/player-display";
import type { PlayerRow } from "@/lib/supabase/types";

type SortCol = "rank" | "name" | "games" | "elo";

const TREND_WINDOW_DAYS = 30;

export function PlayersRanking() {
  const { data: players = [], isLoading } = usePlayers();
  const { data: recentMatches = [] } = useRecentMatches(TREND_WINDOW_DAYS);
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

  // Tendance: Δ Elo de la dernière journée jouée
  const lastDayDelta = useMemo(() => {
    const days = listMatchDays(recentMatches);
    if (days.length === 0) return new Map<string, number>();
    const stats = aggregatePlayersForDay(recentMatches, days[0]);
    const map = new Map<string, number>();
    stats.forEach((s, id) => map.set(id, s.eloDelta));
    return map;
  }, [recentMatches]);

  const displayed = useMemo(() => {
    const sign = sortDir === "asc" ? 1 : -1;
    const arr = [...players];
    arr.sort((a, b) => {
      switch (sortBy) {
        case "rank":
          return sign * ((globalRank.get(a.id) ?? 0) - (globalRank.get(b.id) ?? 0));
        case "name":
          return sign * a.first_name.localeCompare(b.first_name, "fr");
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
                  <TableHead className="w-24 text-right">Tendance</TableHead>
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
                          <AvatarFallback>{initials(p.first_name)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{displayName(p)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {p.games_played}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{p.elo}</TableCell>
                    <TableCell className="text-right">
                      <TrendCell delta={lastDayDelta.get(p.id)} />
                    </TableCell>
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

function TrendCell({ delta }: { delta: number | undefined }) {
  if (delta === undefined) {
    return (
      <span className="inline-flex items-center justify-end gap-1 text-muted-foreground">
        <Minus className="h-3.5 w-3.5" aria-hidden />
        <span className="tabular-nums text-xs">—</span>
      </span>
    );
  }
  if (delta > 0) {
    return (
      <span className="inline-flex items-center justify-end gap-1 text-emerald-600 dark:text-emerald-400">
        <TrendingUp className="h-3.5 w-3.5" aria-hidden />
        <span className="tabular-nums font-semibold">+{delta}</span>
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span className="inline-flex items-center justify-end gap-1 text-destructive">
        <TrendingDown className="h-3.5 w-3.5" aria-hidden />
        <span className="tabular-nums font-semibold">−{Math.abs(delta)}</span>
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center justify-end gap-1 text-muted-foreground")}>
      <Minus className="h-3.5 w-3.5" aria-hidden />
      <span className="tabular-nums">±0</span>
    </span>
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
