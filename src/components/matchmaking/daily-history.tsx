"use client";

import { useState } from "react";
import { ChevronDown, Trophy, History, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTournaments, useTournament } from "@/lib/queries/tournaments";
import { useSessions } from "@/lib/queries/play-sessions";
import { toTournamentView } from "@/lib/tournament";
import { cn } from "@/lib/utils";

export function DailyHistory() {
  const { data: tournaments = [] } = useTournaments({ status: "ended", date: "today" });
  const { data: sessions = [] } = useSessions({ status: "ended", date: "today" });

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
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 p-2 text-sm"
                >
                  <span className="font-medium">{s.label ?? "Partie"}</span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="tabular-nums">
                      {s.match_count} match{s.match_count > 1 ? "s" : ""}
                    </Badge>
                    <Badge variant="outline" className="tabular-nums">
                      cible {s.target_score}
                    </Badge>
                    <span className="tabular-nums">
                      {new Date(s.started_at).toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {s.ended_at && (
                        <>
                          →{" "}
                          {new Date(s.ended_at).toLocaleTimeString("fr-FR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </>
                      )}
                    </span>
                  </span>
                </li>
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
