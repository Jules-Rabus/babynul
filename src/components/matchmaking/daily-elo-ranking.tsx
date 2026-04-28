"use client";

import { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Medal } from "@/components/ranking/medal";
import { useRecentMatches } from "@/lib/queries/matches";
import { usePlayers } from "@/lib/queries/players";
import { displayName } from "@/lib/player-display";
import { initials, cn } from "@/lib/utils";
import type { MatchRow } from "@/lib/db/types";

type DailyStat = {
  playerId: string;
  games: number;
  wins: number;
  losses: number;
  eloDelta: number;
};

function aggregateDaily(matches: MatchRow[]): Map<string, DailyStat> {
  const map = new Map<string, DailyStat>();
  const bump = (id: string | null, side: "A" | "B", m: MatchRow) => {
    if (!id) return;
    const cur = map.get(id) ?? {
      playerId: id,
      games: 0,
      wins: 0,
      losses: 0,
      eloDelta: 0,
    };
    cur.games += 1;
    cur.eloDelta += side === "A" ? m.elo_delta_a : m.elo_delta_b;
    if (m.winner_side === side) cur.wins += 1;
    else cur.losses += 1;
    map.set(id, cur);
  };

  for (const m of matches) {
    bump(m.player_a1_id, "A", m);
    if (m.mode === "team") bump(m.player_a2_id, "A", m);
    bump(m.player_b1_id, "B", m);
    if (m.mode === "team") bump(m.player_b2_id, "B", m);
  }
  return map;
}

export function DailyEloRanking() {
  const { data: matches = [], isLoading } = useRecentMatches(2);
  const { data: players = [] } = usePlayers();

  const todayMatches = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startMs = startOfToday.getTime();
    return matches.filter((m) => new Date(m.played_at).getTime() >= startMs);
  }, [matches]);

  const ranking = useMemo(() => {
    const stats = aggregateDaily(todayMatches);
    const playerById = new Map(players.map((p) => [p.id, p]));
    return Array.from(stats.values())
      .map((s) => ({ ...s, player: playerById.get(s.playerId) ?? null }))
      .filter((r) => r.player !== null)
      .sort((a, b) => b.eloDelta - a.eloDelta);
  }, [todayMatches, players]);

  if (isLoading) return null;
  if (ranking.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4" />
          Classement du jour
        </CardTitle>
        <CardDescription>
          Elo gagné/perdu par joueur sur les matchs joués aujourd&apos;hui.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Rang</TableHead>
              <TableHead>Joueur</TableHead>
              <TableHead className="text-right">Parties</TableHead>
              <TableHead className="text-right">V/D</TableHead>
              <TableHead className="w-24 text-right">Δ Elo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ranking.map((r, i) => {
              const sign = r.eloDelta > 0 ? "+" : r.eloDelta < 0 ? "−" : "±";
              const tone =
                r.eloDelta > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : r.eloDelta < 0
                  ? "text-destructive"
                  : "text-muted-foreground";
              return (
                <TableRow key={r.playerId}>
                  <TableCell>
                    <Medal rank={i + 1} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback>{initials(r.player!.first_name)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{displayName(r.player!)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {r.games}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {r.wins}–{r.losses}
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums font-semibold", tone)}>
                    {sign}
                    {Math.abs(r.eloDelta)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
