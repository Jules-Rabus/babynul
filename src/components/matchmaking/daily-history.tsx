"use client";

import { useState } from "react";
import { ChevronDown, Trophy, History, Clock, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTournaments, useTournament } from "@/lib/queries/tournaments";
import { useSessions } from "@/lib/queries/play-sessions";
import {
  useSessionMatches,
  useDeleteMatch,
} from "@/lib/queries/matches";
import { usePlayers } from "@/lib/queries/players";
import { useAdmin } from "@/components/admin-context";
import { displayName } from "@/lib/player-display";
import { toTournamentView } from "@/lib/tournament";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { MatchRow, PlayerRow } from "@/lib/db/types";

export function DailyHistory() {
  const { data: tournaments = [] } = useTournaments({ status: "ended", date: "today" });
  const { data: sessions = [] } = useSessions({ status: "ended", date: "today" });
  const { data: players = [] } = usePlayers();

  const empty = tournaments.length === 0 && sessions.length === 0;
  if (empty) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" />
          Historique du jour
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {tournaments.length > 0 && (
          <section>
            <h3 className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Trophy className="h-3.5 w-3.5" />
              Tournois clôturés ({tournaments.length})
            </h3>
            <ul className="space-y-2">
              {tournaments.map((t) => (
                <TournamentHistoryRow key={t.id} tournamentId={t.id} summary={t} />
              ))}
            </ul>
          </section>
        )}
        {sessions.length > 0 && (
          <section>
            <h3 className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Parties clôturées ({sessions.length})
            </h3>
            <ul className="space-y-1">
              {sessions.map((s) => (
                <SessionHistoryRow
                  key={s.id}
                  session={s}
                  playerById={
                    new Map<string, PlayerRow>(players.map((p) => [p.id, p]))
                  }
                />
              ))}
            </ul>
          </section>
        )}
      </CardContent>
    </Card>
  );
}

function TournamentHistoryRow({
  tournamentId,
  summary,
}: {
  tournamentId: string;
  summary: {
    label: string | null;
    mode: "individual" | "team";
    size: number;
    target_score: number;
    started_at: string;
    ended_at: string | null;
  };
}) {
  const [open, setOpen] = useState(false);
  const { data } = useTournament(open ? tournamentId : null);
  const view = data ? toTournamentView(data) : null;
  const startedAt = new Date(summary.started_at).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <li className="rounded-lg bg-muted/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-lg p-2 text-left text-sm"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <Trophy className="h-3.5 w-3.5 text-accent" />
          <span className="font-medium">{summary.label ?? "Tournoi"}</span>
        </span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">{summary.mode === "team" ? "2v2" : "1v1"}</Badge>
          <Badge variant="outline">{summary.size} équipes</Badge>
          <Badge variant="outline">cible {summary.target_score}</Badge>
          <span className="tabular-nums">{startedAt}</span>
          <ChevronDown
            className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </span>
      </button>
      {open && view && (
        <div className="space-y-2 border-t border-border p-3">
          {view.champion && (
            <div className="text-sm">
              🏆 Champion : <strong>{view.champion.label}</strong>
            </div>
          )}
          <ul className="space-y-1 text-xs">
            {Array.from(view.matchesByRound.entries())
              .sort(([a], [b]) => a - b)
              .map(([round, matches]) => (
                <li key={round}>
                  <span className="font-semibold text-muted-foreground">
                    {round === 1 ? "Finale" : round === 2 ? "Demi" : `T${round}`} —
                  </span>{" "}
                  {matches
                    .map((m) =>
                      m.status === "played" && m.sideA && m.sideB
                        ? `${m.sideA.label} vs ${m.sideB.label} → ${m.winner?.label ?? "?"}`
                        : null,
                    )
                    .filter(Boolean)
                    .join(" · ")}
                </li>
              ))}
          </ul>
        </div>
      )}
    </li>
  );
}

function SessionHistoryRow({
  session,
  playerById,
}: {
  session: {
    id: string;
    label: string | null;
    match_count: number;
    target_score: number;
    started_at: string;
    ended_at: string | null;
  };
  playerById: Map<string, PlayerRow>;
}) {
  const [open, setOpen] = useState(false);
  const { unlocked } = useAdmin();
  const { data: matches = [] } = useSessionMatches(open ? session.id : null);
  const deleteMatch = useDeleteMatch();
  const [toDelete, setToDelete] = useState<{
    matchId: string;
    label: string;
  } | null>(null);

  const startedAt = new Date(session.started_at).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const endedAt = session.ended_at
    ? new Date(session.ended_at).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const fmtName = (id: string | null) => {
    if (!id) return "?";
    const p = playerById.get(id);
    return p ? displayName(p) : "?";
  };

  const teamLabel = (m: MatchRow, side: "A" | "B"): string => {
    const ids =
      side === "A"
        ? [m.player_a1_id, m.player_a2_id]
        : [m.player_b1_id, m.player_b2_id];
    return ids.filter(Boolean).map((id) => fmtName(id)).join(" & ") || "?";
  };

  return (
    <li className="rounded-lg bg-muted/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg p-2 text-left text-sm"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium">{session.label ?? "Partie"}</span>
        </span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="tabular-nums">
            {session.match_count} match{session.match_count > 1 ? "s" : ""}
          </Badge>
          <Badge variant="outline" className="tabular-nums">
            cible {session.target_score}
          </Badge>
          <span className="tabular-nums">
            {startedAt}
            {endedAt && <> → {endedAt}</>}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </span>
      </button>
      {open && (
        <div className="space-y-1 border-t border-border p-2">
          {matches.length === 0 ? (
            <p className="py-2 text-center text-xs text-muted-foreground">
              Aucun match dans cette partie.
            </p>
          ) : (
            <ol className="space-y-1">
              {matches.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center gap-2 rounded-md bg-background/60 p-2 text-xs"
                >
                  <span className="font-medium">{teamLabel(m, "A")}</span>
                  <span className="font-mono tabular-nums text-muted-foreground">
                    {m.score_a}–{m.score_b}
                  </span>
                  <span className="font-medium">{teamLabel(m, "B")}</span>
                  <span className="ml-auto flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {m.winner_side === "A" ? "A gagne" : "B gagne"}
                    </span>
                    {unlocked && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Annuler totalement ce match (Elo et mises remboursés)"
                        onClick={(e) => {
                          e.stopPropagation();
                          setToDelete({
                            matchId: m.id,
                            label: `${teamLabel(m, "A")} vs ${teamLabel(m, "B")} (${m.score_a}–${m.score_b})`,
                          });
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Annuler totalement ce match ?</DialogTitle>
            <DialogDescription>
              {toDelete?.label}
              <br />
              L&apos;Elo des joueurs et des équipes sera reversé, et toutes
              les mises liées seront remboursées. Cette action est
              irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>
              Garder le match
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!toDelete) return;
                try {
                  await deleteMatch.mutateAsync(toDelete.matchId);
                  toast.success(
                    "Match annulé — Elo reversé, mises remboursées.",
                  );
                  setToDelete(null);
                } catch (err) {
                  toast.error(
                    err instanceof Error ? err.message : "Erreur.",
                  );
                }
              }}
              disabled={deleteMatch.isPending}
            >
              {deleteMatch.isPending ? "Annulation…" : "Annuler le match"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}
