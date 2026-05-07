"use client";

import { useMemo, useState } from "react";
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
import type { PlayerRow } from "@/lib/db/types";
import { aggregatePlayersForDay, dayKey } from "@/lib/daily-elo";
import { DailyPlayerDetailDialog } from "./daily-player-detail-dialog";

export function DailyEloRanking() {
  const { data: matches = [], isLoading } = useRecentMatches(2);
  const { data: players = [] } = usePlayers();
  const [selected, setSelected] = useState<PlayerRow | null>(null);

  const today = useMemo(() => dayKey(new Date().toISOString()), []);

  const todayMatches = useMemo(
    () => matches.filter((m) => dayKey(m.played_at) === today),
    [matches, today],
  );

  const ranking = useMemo(() => {
    const stats = aggregatePlayersForDay(matches, today);
    const playerById = new Map(players.map((p) => [p.id, p]));
    return Array.from(stats.values())
      .map((s) => ({ ...s, player: playerById.get(s.playerId) ?? null }))
      .filter((r) => r.player !== null)
      .sort((a, b) => b.eloDelta - a.eloDelta);
  }, [matches, today, players]);

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
                <TableRow
                  key={r.playerId}
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => setSelected(r.player!)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(r.player!);
                    }
                  }}
                >
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
      <DailyPlayerDetailDialog
        player={selected}
        matches={todayMatches}
        players={players}
        onClose={() => setSelected(null)}
      />
    </Card>
  );
}
