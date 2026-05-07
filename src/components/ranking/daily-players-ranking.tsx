"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DayCarousel } from "./day-carousel";
import { Medal } from "./medal";
import { useRecentMatches } from "@/lib/queries/matches";
import { usePlayers } from "@/lib/queries/players";
import { displayName } from "@/lib/player-display";
import { cn, initials } from "@/lib/utils";
import type { PlayerRow } from "@/lib/db/types";
import {
  aggregatePlayersForDay,
  filterMatchesByDay,
  listMatchDays,
} from "@/lib/daily-elo";
import { DailyPlayerDetailDialog } from "@/components/matchmaking/daily-player-detail-dialog";

const DAYS_WINDOW = 30;

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

function formatDayLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return dateFormatter.format(new Date(y, m - 1, d));
}

export function DailyPlayersRanking() {
  const { data: matches = [], isLoading } = useRecentMatches(DAYS_WINDOW);
  const { data: players = [] } = usePlayers();

  const days = useMemo(() => listMatchDays(matches), [matches]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerRow | null>(null);

  useEffect(() => {
    if (days.length === 0) {
      setSelectedDay(null);
      return;
    }
    if (!selectedDay || !days.includes(selectedDay)) {
      setSelectedDay(days[0]);
    }
  }, [days, selectedDay]);

  const dayMatches = useMemo(
    () => (selectedDay ? filterMatchesByDay(matches, selectedDay) : []),
    [matches, selectedDay],
  );

  const matchCountByDay = useMemo(() => {
    const map: Record<string, number> = {};
    for (const day of days) {
      map[day] = filterMatchesByDay(matches, day).length;
    }
    return map;
  }, [days, matches]);

  const ranking = useMemo(() => {
    if (!selectedDay) return [];
    const stats = aggregatePlayersForDay(matches, selectedDay);
    const playerById = new Map(players.map((p) => [p.id, p]));
    return Array.from(stats.values())
      .map((s) => ({ ...s, player: playerById.get(s.playerId) ?? null }))
      .filter((r) => r.player !== null)
      .sort((a, b) => b.eloDelta - a.eloDelta);
  }, [matches, players, selectedDay]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-4 w-4" />
          Classement de la journée — Individuel
        </CardTitle>
        <CardDescription>
          Elo gagné/perdu par joueur sur la journée sélectionnée.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : days.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Aucun match enregistré sur les {DAYS_WINDOW} derniers jours.
          </p>
        ) : (
          <>
            <div className="mb-4 space-y-3">
              <DayCarousel
                days={days}
                selectedDay={selectedDay}
                onSelect={setSelectedDay}
                matchCountByDay={matchCountByDay}
              />
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium capitalize">
                  {selectedDay ? formatDayLabel(selectedDay) : ""}
                </span>
                <span className="text-xs text-muted-foreground">
                  {dayMatches.length} match{dayMatches.length > 1 ? "s" : ""}
                </span>
              </div>
            </div>
            {ranking.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Aucun match cette journée.
              </p>
            ) : (
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
                        onClick={() => setSelectedPlayer(r.player!)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedPlayer(r.player!);
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
            )}
          </>
        )}
      </CardContent>
      <DailyPlayerDetailDialog
        player={selectedPlayer}
        matches={dayMatches}
        players={players}
        dayLabel={selectedDay ? `le ${formatDayLabel(selectedDay)}` : undefined}
        onClose={() => setSelectedPlayer(null)}
      />
    </Card>
  );
}
