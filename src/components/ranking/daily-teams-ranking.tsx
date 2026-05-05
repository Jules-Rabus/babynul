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
import { DayCarousel } from "./day-carousel";
import { Medal } from "./medal";
import { useRecentMatches } from "@/lib/queries/matches";
import { useTeams, type TeamWithPlayers } from "@/lib/queries/teams";
import { displayName } from "@/lib/player-display";
import { cn } from "@/lib/utils";
import {
  aggregateTeamsForDay,
  filterMatchesByDay,
  listMatchDays,
} from "@/lib/daily-elo";

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

function teamLabel(t: TeamWithPlayers): string {
  const a = t.player1 ? displayName(t.player1) : "?";
  const b = t.player2 ? displayName(t.player2) : "?";
  return `${a} & ${b}`;
}

export function DailyTeamsRanking() {
  const { data: matches = [], isLoading } = useRecentMatches(DAYS_WINDOW);
  const { data: teams = [] } = useTeams();

  const teamMatches = useMemo(
    () => matches.filter((m) => m.mode === "team"),
    [matches],
  );
  const days = useMemo(() => listMatchDays(teamMatches), [teamMatches]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

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
    () => (selectedDay ? filterMatchesByDay(teamMatches, selectedDay) : []),
    [teamMatches, selectedDay],
  );

  const matchCountByDay = useMemo(() => {
    const map: Record<string, number> = {};
    for (const day of days) {
      map[day] = filterMatchesByDay(teamMatches, day).length;
    }
    return map;
  }, [days, teamMatches]);

  const ranking = useMemo(() => {
    if (!selectedDay) return [];
    const stats = aggregateTeamsForDay(teamMatches, selectedDay);
    const teamById = new Map(teams.map((t) => [t.id, t]));
    return Array.from(stats.values())
      .map((s) => ({ ...s, team: teamById.get(s.teamId) ?? null }))
      .filter((r) => r.team !== null)
      .sort((a, b) => b.eloDelta - a.eloDelta);
  }, [teamMatches, teams, selectedDay]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-4 w-4" />
          Classement de la journée — Équipes
        </CardTitle>
        <CardDescription>
          Elo gagné/perdu par équipe sur la journée sélectionnée.
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
            Aucun match équipe enregistré sur les {DAYS_WINDOW} derniers jours.
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
                Aucun match équipe cette journée.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Rang</TableHead>
                    <TableHead>Équipe</TableHead>
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
                      <TableRow key={r.teamId}>
                        <TableCell>
                          <Medal rank={i + 1} />
                        </TableCell>
                        <TableCell className="font-medium">
                          {teamLabel(r.team!)}
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
    </Card>
  );
}
