"use client";

import { useEffect, useMemo, useState } from "react";
import { Trophy, Shuffle, RotateCcw, Target, Users, User, Loader2, PlayCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { usePlayers } from "@/lib/queries/players";
import {
  useCreateTournament,
  useTournament,
  useTournaments,
  useRecordTournamentMatch,
} from "@/lib/queries/tournaments";
import { buildBalancedPairs } from "@/lib/tournaments/pairing";
import {
  toTournamentView,
  roundLabel,
  type TournamentMatchView,
  type TournamentParticipantView,
} from "@/lib/tournament";
import { useAdmin } from "@/components/admin-context";
import { fireVictoryEffects } from "@/lib/effects";
import { cn } from "@/lib/utils";
import { displayName } from "@/lib/player-display";
import { ScoreStepper } from "@/components/ui/score-stepper";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CreateTournamentInput } from "@/lib/schemas";
import { toast } from "sonner";

type Mode = "individual" | "team";

export function TournamentPanel() {
  const { data: players = [] } = usePlayers();
  const { data: activeTournaments = [], isLoading: loadingActive } = useTournaments({
    status: "active",
  });
  const [currentId, setCurrentId] = useState<string | null>(null);

  const running = activeTournaments[0] ?? null;
  const detailId = currentId ?? running?.id ?? null;
  const { data: detail } = useTournament(detailId);

  if (detail) {
    const view = toTournamentView(detail);
    return <BracketView view={view} onExit={() => setCurrentId(null)} />;
  }

  if (loadingActive) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement…
        </CardContent>
      </Card>
    );
  }

  return <TournamentSetup players={players} onCreated={setCurrentId} />;
}

// ---------------------------------------------------------------------------
// Setup (création)
// ---------------------------------------------------------------------------
function TournamentSetup({
  players,
  onCreated,
}: {
  players: Array<{ id: string; first_name: string; nickname: string | null; elo: number }>;
  onCreated: (id: string) => void;
}) {
  const { unlocked } = useAdmin();
  const [mode, setMode] = useState<Mode>("team");
  const [targetScore, setTargetScore] = useState(10);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const create = useCreateTournament();

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

  const selectedCount = selectedIds.size;
  const minNeeded = mode === "team" ? 4 : 2;
  // En team, il faut un nombre PAIR de joueurs (1 paire = 2).
  const teamValid = mode === "individual" || selectedCount % 2 === 0;
  const canStart = unlocked && selectedCount >= minNeeded && teamValid;

  const handleStart = async () => {
    if (!canStart) return;
    const selected = players.filter((p) => selectedIds.has(p.id));
    let slots: CreateTournamentInput["slots"];
    if (mode === "individual") {
      slots = selected.map((p) => ({
        player_id: p.id,
        label: displayName(p),
      }));
    } else {
      const pairs = buildBalancedPairs(
        selected.map((p) => ({ id: p.id, elo: p.elo })),
      );
      slots = pairs.map(([a, b]) => {
        const pa = selected.find((p) => p.id === a.id)!;
        const pb = selected.find((p) => p.id === b.id)!;
        return {
          p1: a.id,
          p2: b.id,
          label: `${displayName(pa)} & ${displayName(pb)}`,
        };
      });
    }
    try {
      const id = await create.mutateAsync({
        mode,
        targetScore,
        slots,
      });
      toast.success("Tournoi démarré.");
      onCreated(id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Nouveau tournoi
        </CardTitle>
        <CardDescription>
          Bracket à élimination directe. Les matchs sont calculés un par un quand les scores sont saisis.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/40 p-2">
          <Button
            type="button"
            variant={mode === "individual" ? "default" : "outline"}
            size="lg"
            onClick={() => setMode("individual")}
            className="h-11"
          >
            <User className="h-4 w-4" />
            1 vs 1
          </Button>
          <Button
            type="button"
            variant={mode === "team" ? "default" : "outline"}
            size="lg"
            onClick={() => setMode("team")}
            className="h-11"
          >
            <Users className="h-4 w-4" />
            2 vs 2
          </Button>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-muted/40 p-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Score cible
          </span>
          <div className="ml-auto flex gap-1">
            {[3, 5, 7, 10].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTargetScore(t)}
                className={cn(
                  "min-h-[36px] min-w-[44px] rounded-md px-2 text-sm font-medium transition-colors",
                  targetScore === t
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-foreground ring-1 ring-border hover:bg-muted",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <Input
          placeholder="Rechercher un joueur…"
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
                  "inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors",
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

        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <span className="text-sm text-muted-foreground">
            {selectedCount} sélectionné{selectedCount > 1 ? "s" : ""}
            {mode === "team" && !teamValid && " — nombre pair requis"}
          </span>
          <Button
            onClick={handleStart}
            disabled={!canStart || create.isPending}
            size="lg"
            className="w-full sm:w-auto"
          >
            <Shuffle className="h-4 w-4" />
            Démarrer · {mode === "team" ? selectedCount / 2 : selectedCount} équipes
          </Button>
        </div>
        {!unlocked && (
          <p className="text-xs italic text-muted-foreground">
            Débloquez le mode admin pour démarrer un tournoi.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Bracket view (tournoi en cours ou clôturé)
// ---------------------------------------------------------------------------
function BracketView({
  view,
  onExit,
}: {
  view: ReturnType<typeof toTournamentView>;
  onExit: () => void;
}) {
  const [scoring, setScoring] = useState<TournamentMatchView | null>(null);
  const rounds = Array.from({ length: view.rounds }, (_, i) => view.rounds - i);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex flex-wrap items-center gap-2">
            <Trophy className="h-5 w-5" />
            {view.label ?? `Tournoi ${view.mode === "team" ? "2v2" : "1v1"}`}
            <Badge variant="outline">{view.size} équipes</Badge>
            <Badge variant="outline">premier à {view.targetScore}</Badge>
          </CardTitle>
          {view.champion && (
            <CardDescription className="flex items-center gap-2 pt-1">
              <Badge variant="accent" className="text-sm">
                🏆 Champion : {view.champion.label}
              </Badge>
            </CardDescription>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={onExit} className="w-full sm:w-auto">
          <RotateCcw className="h-4 w-4" />
          Nouveau tournoi
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2">
          {rounds.map((r) => {
            const matches = view.matchesByRound.get(r) ?? [];
            const expected = Math.pow(2, r - 1);
            return (
              <div key={r} className="flex min-w-[220px] flex-col gap-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {roundLabel(r)}
                </h3>
                <div className="flex flex-1 flex-col justify-around gap-3">
                  {Array.from({ length: expected }, (_, i) => {
                    const m = matches.find((x) => x.slot === i);
                    if (!m) {
                      return <PlaceholderMatch key={i} />;
                    }
                    return (
                      <BracketMatch
                        key={m.id}
                        match={m}
                        onScore={view.status === "active" ? () => setScoring(m) : undefined}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
      <ScoreDialog
        match={scoring}
        targetScore={view.targetScore}
        tournamentId={view.id}
        onClose={() => setScoring(null)}
      />
    </Card>
  );
}

function PlaceholderMatch() {
  return (
    <div className="space-y-1 rounded-lg bg-muted/20 p-2 opacity-60">
      <div className="h-7 rounded-md bg-muted/40" />
      <div className="h-7 rounded-md bg-muted/40" />
    </div>
  );
}

function BracketMatch({
  match,
  onScore,
}: {
  match: TournamentMatchView;
  onScore?: () => void;
}) {
  const canScore = match.status === "ready" && !!onScore;
  return (
    <div className="space-y-1 rounded-lg bg-muted/40 p-2">
      <Slot participant={match.sideA} isWinner={match.winner?.slot === match.sideA?.slot} />
      <Slot participant={match.sideB} isWinner={match.winner?.slot === match.sideB?.slot} />
      {canScore && (
        <Button
          type="button"
          size="sm"
          variant="default"
          onClick={onScore}
          className="mt-1 h-9 w-full"
        >
          <PlayCircle className="h-4 w-4" />
          Saisir le score
        </Button>
      )}
      {match.status === "bye" && (
        <p className="text-center text-[10px] italic text-muted-foreground">Qualification auto</p>
      )}
    </div>
  );
}

function Slot({
  participant,
  isWinner,
}: {
  participant: TournamentParticipantView | null;
  isWinner: boolean;
}) {
  if (!participant) {
    return (
      <div className="rounded-md bg-muted/30 px-2 py-1.5 text-xs italic text-muted-foreground">
        —
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm",
        isWinner ? "bg-primary font-semibold text-primary-foreground" : "bg-background ring-1 ring-border",
      )}
    >
      <span className="truncate">{participant.label}</span>
      <span className="shrink-0 text-[11px] opacity-70 tabular-nums">{participant.elo}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dialog de saisie de score pour un match de tournoi
// ---------------------------------------------------------------------------
function ScoreDialog({
  match,
  targetScore,
  tournamentId,
  onClose,
}: {
  match: TournamentMatchView | null;
  targetScore: number;
  tournamentId: string;
  onClose: () => void;
}) {
  const record = useRecordTournamentMatch(tournamentId);
  const [scoreA, setScoreA] = useState(targetScore);
  const [scoreB, setScoreB] = useState(0);

  const matchId = match?.id;
  // Reset à l'ouverture.
  useEffect(() => {
    if (matchId) {
      setScoreA(targetScore);
      setScoreB(0);
    }
  }, [matchId, targetScore]);

  if (!match) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (scoreA === scoreB) {
      toast.error("Un vainqueur est requis.");
      return;
    }
    if (Math.max(scoreA, scoreB) !== targetScore) {
      toast.error(`Le vainqueur doit atteindre ${targetScore}.`);
      return;
    }
    try {
      await record.mutateAsync({ tournamentMatchId: match.id, scoreA, scoreB });
      toast.success("Match enregistré.");
      void fireVictoryEffects();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur.");
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Saisir le score</DialogTitle>
          <DialogDescription>
            {match.sideA?.label ?? "?"} vs {match.sideB?.label ?? "?"} — premier à {targetScore}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <ScoreStepper
              label={match.sideA?.label ?? "A"}
              value={scoreA}
              onChange={setScoreA}
              max={targetScore}
            />
            <ScoreStepper
              label={match.sideB?.label ?? "B"}
              value={scoreB}
              onChange={setScoreB}
              max={targetScore}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={record.isPending}>
              {record.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
