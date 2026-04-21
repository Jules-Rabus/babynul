"use client";

import { useMemo, useState } from "react";
import { Trophy, Shuffle, RotateCcw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { usePlayers } from "@/lib/queries/players";
import {
  createTournament,
  getChampion,
  roundLabel,
  setWinner,
  type Tournament,
  type TournamentMatch,
} from "@/lib/tournament";
import { fireVictoryEffects } from "@/lib/effects";
import { cn } from "@/lib/utils";
import { displayName } from "@/lib/player-display";

export function TournamentPanel() {
  const { data: players = [] } = usePlayers();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [tournament, setTournament] = useState<Tournament | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? players.filter(
          (p) =>
            p.first_name.toLowerCase().includes(q) ||
            (p.nickname ?? "").toLowerCase().includes(q),
        )
      : players;
  }, [players, search]);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startTournament = () => {
    const selected = players.filter((p) => selectedIds.has(p.id));
    if (selected.length < 2) return;
    setTournament(createTournament(selected));
  };

  const reset = () => {
    setTournament(null);
  };

  const pickWinner = (matchId: string, winnerId: string) => {
    if (!tournament) return;
    const updated = setWinner(tournament, matchId, winnerId);
    setTournament(updated);
    const champion = getChampion(updated);
    if (champion) void fireVictoryEffects();
  };

  if (tournament) {
    return <BracketView tournament={tournament} onPickWinner={pickWinner} onReset={reset} />;
  }

  const canStart = selectedIds.size >= 2;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Tournoi
        </CardTitle>
        <CardDescription>
          Sélectionnez les participants (min. 2). Un bracket à élimination directe sera généré avec tirage au sort.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {filtered.map((p) => {
            const on = selectedIds.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors",
                  on ? "bg-primary text-primary-foreground" : "bg-muted text-foreground hover:bg-muted/80",
                )}
              >
                {displayName(p)}
                <span className="text-xs opacity-70">{p.elo}</span>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="py-4 text-sm text-muted-foreground">Aucun joueur.</p>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 pt-2">
          <span className="text-sm text-muted-foreground">
            {selectedIds.size} sélectionné{selectedIds.size > 1 ? "s" : ""}
          </span>
          <Button onClick={startTournament} disabled={!canStart}>
            <Shuffle className="h-4 w-4" />
            Générer le bracket
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BracketView({
  tournament,
  onPickWinner,
  onReset,
}: {
  tournament: Tournament;
  onPickWinner: (matchId: string, winnerId: string) => void;
  onReset: () => void;
}) {
  const champion = getChampion(tournament);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Bracket {tournament.size} joueurs
          </CardTitle>
          {champion && (
            <CardDescription className="flex items-center gap-2 pt-1">
              <Badge variant="accent" className="text-sm">🏆 Champion : {displayName(champion)}</Badge>
            </CardDescription>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={onReset}>
          <RotateCcw className="h-4 w-4" />
          Réinitialiser
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {Array.from({ length: tournament.rounds }, (_, i) => tournament.rounds - i).map((r) => (
            <div key={r} className="flex min-w-[200px] flex-col gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {roundLabel(r)}
              </h3>
              <div className="flex flex-1 flex-col justify-around gap-3">
                {tournament.matches
                  .filter((m) => m.round === r)
                  .map((m) => (
                    <BracketMatch key={m.id} match={m} onPickWinner={onPickWinner} />
                  ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function BracketMatch({
  match,
  onPickWinner,
}: {
  match: TournamentMatch;
  onPickWinner: (matchId: string, winnerId: string) => void;
}) {
  const PlayerSlot = ({
    player,
    isWinner,
    onClick,
  }: {
    player: TournamentMatch["p1"];
    isWinner: boolean;
    onClick: () => void;
  }) => {
    if (!player) {
      return (
        <div className="rounded-md bg-muted/30 px-2 py-1.5 text-xs italic text-muted-foreground">
          —
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={!match.p1 || !match.p2}
        className={cn(
          "w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors",
          isWinner
            ? "bg-primary text-primary-foreground font-semibold"
            : "bg-muted hover:bg-muted/70",
          (!match.p1 || !match.p2) && "cursor-not-allowed opacity-60 hover:bg-muted",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate">{displayName(player)}</span>
          <span className="shrink-0 text-xs opacity-70">{player.elo}</span>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-1 rounded-lg bg-muted/40 p-2">
      <PlayerSlot
        player={match.p1}
        isWinner={!!match.p1 && match.winner?.id === match.p1.id}
        onClick={() => match.p1 && onPickWinner(match.id, match.p1.id)}
      />
      <PlayerSlot
        player={match.p2}
        isWinner={!!match.p2 && match.winner?.id === match.p2.id}
        onClick={() => match.p2 && onPickWinner(match.id, match.p2.id)}
      />
    </div>
  );
}
