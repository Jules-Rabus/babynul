"use client";

import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { displayName } from "@/lib/player-display";
import { initials, cn } from "@/lib/utils";
import type { MatchRow, PlayerRow } from "@/lib/db/types";
import { deltaForPlayer } from "@/lib/match-delta";

type Props = {
  player: PlayerRow | null;
  matches: MatchRow[];
  players: PlayerRow[];
  onClose: () => void;
};

type PlayerMatchView = {
  match: MatchRow;
  side: "A" | "B";
  delta: number;
  won: boolean;
  partnerId: string | null;
  opponentIds: string[];
};

function viewsForPlayer(matches: MatchRow[], playerId: string): PlayerMatchView[] {
  const out: PlayerMatchView[] = [];
  for (const m of matches) {
    const onA = m.player_a1_id === playerId || m.player_a2_id === playerId;
    const onB = m.player_b1_id === playerId || m.player_b2_id === playerId;
    if (!onA && !onB) continue;
    const side = onA ? "A" : "B";
    const delta = deltaForPlayer(m, playerId);
    const won = m.winner_side === side;
    const partnerId =
      m.mode === "team"
        ? side === "A"
          ? m.player_a1_id === playerId
            ? m.player_a2_id
            : m.player_a1_id
          : m.player_b1_id === playerId
            ? m.player_b2_id
            : m.player_b1_id
        : null;
    const opponentIds: string[] =
      side === "A"
        ? [m.player_b1_id, m.player_b2_id].filter(
            (x): x is string => typeof x === "string",
          )
        : [m.player_a1_id, m.player_a2_id].filter(
            (x): x is string => typeof x === "string",
          );
    out.push({ match: m, side, delta, won, partnerId, opponentIds });
  }
  // Plus récents en haut.
  return out.sort(
    (a, b) =>
      new Date(b.match.played_at).getTime() -
      new Date(a.match.played_at).getTime(),
  );
}

export function DailyPlayerDetailDialog({
  player,
  matches,
  players,
  onClose,
}: Props) {
  const playerById = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players],
  );

  const views = useMemo(
    () => (player ? viewsForPlayer(matches, player.id) : []),
    [matches, player],
  );

  const summary = useMemo(() => {
    if (!player) return null;
    const wins = views.filter((v) => v.won).length;
    const losses = views.length - wins;
    const delta = views.reduce((s, v) => s + v.delta, 0);
    const best = views.reduce<PlayerMatchView | null>(
      (b, v) => (b === null || v.delta > b.delta ? v : b),
      null,
    );
    const worst = views.reduce<PlayerMatchView | null>(
      (b, v) => (b === null || v.delta < b.delta ? v : b),
      null,
    );
    return { wins, losses, delta, best, worst, count: views.length };
  }, [player, views]);

  if (!player) return null;

  const fmtName = (id: string | null) => {
    if (!id) return "?";
    const p = playerById.get(id);
    return p ? displayName(p) : "?";
  };

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <Dialog open={!!player} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback>{initials(player.first_name)}</AvatarFallback>
            </Avatar>
            <span>{displayName(player)}</span>
            <span className="text-sm font-normal text-muted-foreground">
              · Elo {player.elo}
            </span>
          </DialogTitle>
          <DialogDescription>
            Détail des matchs joués aujourd&apos;hui.
          </DialogDescription>
        </DialogHeader>

        {summary && summary.count === 0 ? (
          <p className="rounded-md bg-muted p-4 text-center text-sm text-muted-foreground">
            Aucun match aujourd&apos;hui.
          </p>
        ) : summary ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Matchs" value={summary.count.toString()} />
              <Stat
                label="V / D"
                value={`${summary.wins}–${summary.losses}`}
              />
              <Stat
                label="Δ Elo"
                value={`${summary.delta > 0 ? "+" : summary.delta < 0 ? "−" : "±"}${Math.abs(summary.delta)}`}
                tone={
                  summary.delta > 0
                    ? "pos"
                    : summary.delta < 0
                      ? "neg"
                      : "neutral"
                }
              />
            </div>

            <ol className="space-y-2 text-sm">
              {views.map((v) => {
                const teamLabel =
                  v.match.mode === "team" && v.partnerId
                    ? `avec ${fmtName(v.partnerId)}`
                    : "1v1";
                const opponents = v.opponentIds.map(fmtName).join(" & ") || "?";
                const sign = v.delta > 0 ? "+" : v.delta < 0 ? "−" : "±";
                const tone =
                  v.delta > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : v.delta < 0
                      ? "text-destructive"
                      : "text-muted-foreground";
                const scoreLeft =
                  v.side === "A" ? v.match.score_a : v.match.score_b;
                const scoreRight =
                  v.side === "A" ? v.match.score_b : v.match.score_a;
                return (
                  <li
                    key={v.match.id}
                    className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/40 p-3"
                  >
                    <Badge
                      variant={v.won ? "default" : "secondary"}
                      className="font-mono"
                    >
                      {v.won ? "V" : "D"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {teamLabel}
                    </span>
                    <span className="font-medium">vs {opponents}</span>
                    <span className="ml-auto flex items-center gap-3">
                      <span className="font-mono tabular-nums text-muted-foreground">
                        {scoreLeft}–{scoreRight}
                      </span>
                      <span className={cn("font-semibold tabular-nums", tone)}>
                        {sign}
                        {Math.abs(v.delta)}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {fmtTime(v.match.played_at)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg" | "neutral";
}) {
  const toneClass =
    tone === "pos"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "neg"
        ? "text-destructive"
        : "text-foreground";
  return (
    <div className="rounded-lg bg-muted/40 p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn("text-lg font-semibold tabular-nums", toneClass)}>
        {value}
      </p>
    </div>
  );
}
