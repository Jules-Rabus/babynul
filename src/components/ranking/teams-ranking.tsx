"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTeams, type TeamWithPlayers } from "@/lib/queries/teams";
import { SortHeader, type SortDir } from "./sort-header";
import { Medal } from "./medal";
import { displayName } from "@/lib/player-display";
type SortCol = "rank" | "name" | "games" | "elo";

function teamLabel(t: TeamWithPlayers) {
  const a = t.player1 ? displayName(t.player1) : "?";
  const b = t.player2 ? displayName(t.player2) : "?";
  return `${a} & ${b}`;
}

export function TeamsRanking() {
  const { data: teams = [], isLoading } = useTeams();
  const [sortBy, setSortBy] = useState<SortCol>("elo");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const globalRank = useMemo(() => {
    const sorted = [...teams].sort((a, b) => b.elo - a.elo);
    const map = new Map<string, number>();
    sorted.forEach((t, i) => map.set(t.id, i + 1));
    return map;
  }, [teams]);

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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
