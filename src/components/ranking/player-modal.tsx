"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { usePlayerMatches } from "@/lib/queries/matches";
import { usePlayers } from "@/lib/queries/players";
import { initials } from "@/lib/utils";
import type { PlayerRow, MatchRow } from "@/lib/supabase/types";
import { useMemo } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function PlayerModal({
  player,
  open,
  onOpenChange,
}: {
  player: PlayerRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { data: matches = [], isLoading } = usePlayerMatches(player?.id ?? null);
  const { data: players = [] } = usePlayers();

  const playerMap = useMemo(() => {
    const m = new Map<string, PlayerRow>();
    players.forEach((p) => m.set(p.id, p));
    return m;
  }, [players]);

  const eloSeries = useMemo(() => {
    if (!player) return [];
    // Reconstruit l'évolution de l'Elo depuis le début en partant de la fin (ordre chronologique)
    const chronological = [...matches].reverse();
    let elo = player.elo;
    // On soustrait tous les deltas futurs → Elo de départ
    for (const m of chronological) {
      elo -= deltaFor(m, player.id);
    }
    const startingElo = elo;
    const series: { date: string; elo: number }[] = [
      { date: "Début", elo: startingElo },
    ];
    let running = startingElo;
    for (const m of chronological) {
      running += deltaFor(m, player.id);
      series.push({
        date: new Date(m.played_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
        elo: running,
      });
    }
    return series;
  }, [matches, player]);

  if (!player) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="text-lg">
                {initials(player.first_name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <DialogTitle className="text-2xl">{player.first_name}</DialogTitle>
              <DialogDescription className="flex items-center gap-2 pt-1">
                <Badge>{player.elo} Elo</Badge>
                <span>{player.games_played} parties</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <section>
          <h3 className="mb-2 text-sm font-semibold">Évolution de l&apos;Elo</h3>
          {eloSeries.length <= 1 ? (
            <p className="rounded-md bg-muted p-4 text-center text-sm text-muted-foreground">
              Pas encore assez de parties pour tracer une courbe.
            </p>
          ) : (
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={eloSeries}>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickMargin={8} stroke="currentColor" strokeOpacity={0.3} />
                  <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} width={40} stroke="currentColor" strokeOpacity={0.3} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "none",
                      borderRadius: 12,
                      color: "hsl(var(--popover-foreground))",
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="elo"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "hsl(var(--chart-1))" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">Historique des parties</h3>
          {isLoading ? (
            <div className="space-y-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : matches.length === 0 ? (
            <p className="rounded-md bg-muted p-4 text-center text-sm text-muted-foreground">
              Pas encore de parties enregistrées.
            </p>
          ) : (
            <ul className="divide-y divide-border/50 overflow-hidden rounded-md bg-muted/40">
              {matches.map((m) => (
                <MatchRowItem key={m.id} match={m} playerId={player.id} playerMap={playerMap} />
              ))}
            </ul>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}

function deltaFor(match: MatchRow, playerId: string) {
  const onA = match.player_a1_id === playerId || match.player_a2_id === playerId;
  return onA ? match.elo_delta_a : match.elo_delta_b;
}

function MatchRowItem({
  match,
  playerId,
  playerMap,
}: {
  match: MatchRow;
  playerId: string;
  playerMap: Map<string, PlayerRow>;
}) {
  const onA = match.player_a1_id === playerId || match.player_a2_id === playerId;
  const won = (onA && match.winner_side === "A") || (!onA && match.winner_side === "B");
  const delta = onA ? match.elo_delta_a : match.elo_delta_b;
  const date = new Date(match.played_at).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });

  const teamLabel = (side: "A" | "B") => {
    const ids = side === "A"
      ? [match.player_a1_id, match.player_a2_id]
      : [match.player_b1_id, match.player_b2_id];
    return ids
      .filter(Boolean)
      .map((id) => {
        const p = playerMap.get(id as string);
        return p ? p.first_name : "?";
      })
      .join(" & ");
  };

  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
      <div className="flex flex-1 flex-col">
        <span className="text-xs text-muted-foreground">{date}</span>
        <span className="font-medium">
          {teamLabel("A")} {match.score_a} – {match.score_b} {teamLabel("B")}
        </span>
      </div>
      <Badge variant={won ? "default" : "destructive"}>
        {won ? "Gagné" : "Perdu"} ({delta > 0 ? "+" : ""}
        {delta})
      </Badge>
    </li>
  );
}
