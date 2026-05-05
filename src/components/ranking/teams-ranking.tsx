"use client";

import { useMemo, useState } from "react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTeams, type TeamWithPlayers } from "@/lib/queries/teams";
import { useRecentMatches } from "@/lib/queries/matches";
import { aggregateTeamsForDay, listMatchDays } from "@/lib/daily-elo";
import { SortHeader, type SortDir } from "./sort-header";
import { Medal } from "./medal";
import { displayName } from "@/lib/player-display";
import { cn } from "@/lib/utils";
type SortCol = "rank" | "name" | "games" | "elo";

const TREND_WINDOW_DAYS = 30;

function teamLabel(t: TeamWithPlayers) {
  const a = t.player1 ? displayName(t.player1) : "?";
  const b = t.player2 ? displayName(t.player2) : "?";
  return `${a} & ${b}`;
}

export function TeamsRanking() {
  const { data: teams = [], isLoading } = useTeams();
  const { data: recentMatches = [] } = useRecentMatches(TREND_WINDOW_DAYS);
  const [sortBy, setSortBy] = useState<SortCol>("elo");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const globalRank = useMemo(() => {
    const sorted = [...teams].sort((a, b) => b.elo - a.elo);
    const map = new Map<string, number>();
    sorted.forEach((t, i) => map.set(t.id, i + 1));
    return map;
  }, [teams]);

  const lastDayDelta = useMemo(() => {
    const teamMatches = recentMatches.filter((m) => m.mode === "team");
    const days = listMatchDays(teamMatches);
    if (days.length === 0) return new Map<string, number>();
    const stats = aggregateTeamsForDay(teamMatches, days[0]);
    const map = new Map<string, number>();
    stats.forEach((s, id) => map.set(id, s.eloDelta));
    return map;
  }, [recentMatches]);

  const displayed = useMemo(() => {
    const sign = sortDir === "asc" ? 1 : -1;
    const arr = [...teams];
    arr.sort((a, b) => {
      switch (sortBy) {
        case "rank":
          return sign * ((globalRank.get(a.id) ?? 0) - (globalRank.get(b.id) ?? 0));
        case "name":
          return sign * teamLabel(a).localeCompare(teamLabel(b), "fr");
        case "games":
          return sign * (a.games_played - b.games_played);
        case "elo":
        default:
          return sign * (a.elo - b.elo);
      }
    });
    return arr;
  }, [teams, sortBy, sortDir, globalRank]);

  const handleSort = (col: SortCol) => {
    if (col === sortBy) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(col);
      setSortDir(col === "name" ? "asc" : "desc");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Classement — Équipes</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : teams.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Aucune équipe pour l&apos;instant. Les équipes se créent automatiquement lors de la saisie d&apos;un match 2v2.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">
                  <SortHeader label="Rang" column="rank" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortHeader label="Équipe" column="name" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                </TableHead>
                <TableHead className="text-right">
                  <SortHeader label="Parties" column="games" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} align="right" />
                </TableHead>
                <TableHead className="w-24 text-right">
                  <SortHeader label="Elo" column="elo" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} align="right" />
                </TableHead>
                <TableHead className="w-24 text-right">Tendance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayed.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <Medal rank={globalRank.get(t.id) ?? 0} />
                  </TableCell>
                  <TableCell className="font-medium">{teamLabel(t)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {t.games_played}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{t.elo}</TableCell>
                  <TableCell className="text-right">
                    <TrendCell delta={lastDayDelta.get(t.id)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
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
