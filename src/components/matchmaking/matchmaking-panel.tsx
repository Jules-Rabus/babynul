"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePlayers } from "@/lib/queries/players";
import { generateMatches } from "@/lib/matchmaking";
import { Shuffle, Users, Coins, Swords, Trash2, PlayCircle, Pencil, Volume2, VolumeX, Trophy } from "lucide-react";
import { useAdmin } from "@/components/admin-context";
import {
  useCreateProposedMatch,
  useSessionProposedMatches,
  useCancelProposedMatch,
  type ProposedMatchWithPlayers,
} from "@/lib/queries/wagers";
import { useRecentMatches, useSessionMatches } from "@/lib/queries/matches";
import {
  useActiveSession,
  useSessionPresence,
  useCancelOpenSessionMatches,
  useStartSession,
} from "@/lib/queries/play-sessions";
import { detectRivalries, rivalryLabel, type Rivalry } from "@/lib/rivalries";
import { displayName } from "@/lib/player-display";
import { usePlayerForms } from "@/hooks/use-player-forms";
import { useVoiceEnabled } from "@/lib/voice/use-announce-next-match";
import { SessionControls } from "./session-controls";
import { RecordSessionMatchDialog } from "./record-session-match-dialog";
import { EditMatchDialog } from "./edit-match-dialog";
import { DailyHistory } from "./daily-history";
import { MatchBettingInline } from "@/components/wagers/match-betting-inline";
import { toast } from "sonner";

export function MatchmakingPanel() {
  const { data: players = [] } = usePlayers();
  const { data: recentMatches = [] } = useRecentMatches(30);
  const { data: active } = useActiveSession();
  const { unlocked } = useAdmin();

  const sessionId = active?.session.id ?? null;
  const { data: sessionProposed = [] } = useSessionProposedMatches(sessionId);
  const { data: sessionMatches = [] } = useSessionMatches(sessionId);

  const createProposed = useCreateProposedMatch();
  const cancelProposed = useCancelProposedMatch();
  const setPresence = useSessionPresence();
  const cancelAllOpen = useCancelOpenSessionMatches();
  const startSession = useStartSession();

  const [search, setSearch] = useState("");
  const [toLeave, setToLeave] = useState<string | null>(null);
  const [toRecord, setToRecord] = useState<ProposedMatchWithPlayers | null>(null);
  const [toEdit, setToEdit] = useState<ProposedMatchWithPlayers | null>(null);

  const sessionMatchById = useMemo(() => {
    const map = new Map<string, (typeof sessionMatches)[number]>();
    for (const m of sessionMatches) map.set(m.id, m);
    return map;
  }, [sessionMatches]);

  const editMatchRow = toEdit?.match_id ? sessionMatchById.get(toEdit.match_id) : null;

  const voice = useVoiceEnabled();

  // Crée une session implicite si aucune n'est active, puis renvoie son id.
  // On ne veut plus de "mode local" — toute action de matchmaking persiste en DB
  // et se propage aux autres utilisateurs via SSE.
  const ensureActiveSession = async (): Promise<string> => {
    if (sessionId) return sessionId;
    const now = new Date();
    const label = `Partie du ${now.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })} ${now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
    return startSession.mutateAsync({ label });
  };

  const requireAdmin = (action: () => void) => {
    if (!unlocked) {
      toast.error("Débloquez le mode admin (bouton 🔒 en haut) pour cette action.");
      return;
    }
    action();
  };

  const presentPlayerIds = useMemo(
    () =>
      new Set(
        active?.participants.filter((p) => p.is_present).map((p) => p.player_id) ?? [],
      ),
    [active],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return players;
    return players.filter(
      (p) =>
        p.first_name.toLowerCase().includes(q) ||
        (p.nickname ?? "").toLowerCase().includes(q),
    );
  }, [players, search]);

  const sessionGamesByPlayer = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of sessionMatches) {
      for (const id of [m.player_a1_id, m.player_a2_id, m.player_b1_id, m.player_b2_id]) {
        if (id) map.set(id, (map.get(id) ?? 0) + 1);
      }
    }
    return map;
  }, [sessionMatches]);

  const presentPlayers = useMemo(
    () => players.filter((p) => presentPlayerIds.has(p.id)),
    [players, presentPlayerIds],
  );

  const presentIdsList = useMemo(
    () => presentPlayers.map((p) => p.id),
    [presentPlayers],
  );
  const playerForms = usePlayerForms(presentIdsList, sessionId);

  const rivalries = useMemo(
    () => detectRivalries(recentMatches, presentPlayers),
    [recentMatches, presentPlayers],
  );

  const hasOpenMatch = (playerId: string) =>
    sessionProposed.some(
      (m) =>
        m.status === "open" &&
        [m.team_a_p1, m.team_a_p2, m.team_b_p1, m.team_b_p2].includes(playerId),
    );

  const toggle = async (id: string) => {
    try {
      const sid = await ensureActiveSession();
      const currently = presentPlayerIds.has(id);
      if (currently && hasOpenMatch(id)) {
        setToLeave(id);
        return;
      }
      await setPresence.mutateAsync({
        sessionId: sid,
        playerId: id,
        present: !currently,
      });
      // Proposer une régénération si la composition vient de changer
      // et qu'il reste au moins 4 joueurs pour en profiter.
      if (unlocked && openSessionMatches.length > 0 && presentPlayerIds.size >= 4) {
        toast.info(
          currently
            ? "Joueur absent. Régénérer la suite ?"
            : "Nouveau joueur. L'intégrer dans les prochains matchs ?",
          {
            action: {
              label: "Régénérer",
              onClick: () => {
                requireAdmin(regenerate);
              },
            },
            duration: 8000,
          },
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur.");
    }
  };

  const confirmLeave = async () => {
    if (!sessionId || !toLeave) return;
    try {
      await setPresence.mutateAsync({
        sessionId,
        playerId: toLeave,
        present: false,
      });
      setToLeave(null);
      toast.success("Joueur retiré. Matchs ouverts annulés, mises remboursées.", {
        action: {
          label: "Régénérer la suite",
          onClick: () => {
            requireAdmin(regenerate);
          },
        },
        duration: 8000,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur.");
    }
  };

  const generate = async () => {
    const selected = presentPlayers;
    if (selected.length < 4) {
      toast.error("Il faut au moins 4 joueurs présents.");
      return;
    }
    try {
      const sid = await ensureActiveSession();
      const generated = generateMatches(selected, {
        sessionGamesPlayed: sessionGamesByPlayer,
      });
      for (const m of generated) {
        const [a1, a2] = m.teamA.players;
        const [b1, b2] = m.teamB.players;
        await createProposed.mutateAsync({
          mode: "team",
          team_a_p1: a1.id,
          team_a_p2: a2.id,
          team_b_p1: b1.id,
          team_b_p2: b2.id,
          elo_a: m.teamA.avgElo,
          elo_b: m.teamB.avgElo,
          session_id: sid,
        });
      }
      toast.success(`${generated.length} matchs générés.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur.");
    }
  };

  const regenerate = async () => {
    try {
      const sid = await ensureActiveSession();
      await cancelAllOpen.mutateAsync(sid);
      await generate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur.");
    }
  };

  const canGenerate = presentPlayerIds.size >= 4;

  const openRivalryBetting = async (r: Rivalry) => {
    const avg = (arr: { elo: number }[]) => Math.round(arr.reduce((s, p) => s + p.elo, 0) / arr.length);
    try {
      const sid = await ensureActiveSession();
      await createProposed.mutateAsync({
        mode: r.mode,
        team_a_p1: r.teamA[0].id,
        team_a_p2: r.teamA[1]?.id ?? null,
        team_b_p1: r.teamB[0].id,
        team_b_p2: r.teamB[1]?.id ?? null,
        elo_a: avg(r.teamA),
        elo_b: avg(r.teamB),
        session_id: sid,
      });
      toast.success("Paris ouverts sur ce face-à-face.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur.");
    }
  };

  const openSessionMatches = sessionProposed.filter((m) => m.status === "open");
  const playedSessionMatches = sessionProposed.filter((m) => m.status === "resolved");

  return (
    <div className="space-y-4">
      <SessionControls />

      {voice.mounted && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={voice.toggle}
            title={voice.enabled ? "Couper le mode vocal" : "Activer le mode vocal"}
          >
            {voice.enabled ? (
              <Volume2 className="h-4 w-4 text-primary" />
            ) : (
              <VolumeX className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="hidden sm:inline">
              {voice.enabled ? "Mode vocal actif" : "Mode vocal"}
            </span>
          </Button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr,1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Joueurs présents
            </CardTitle>
            <CardDescription>
              Cliquez pour marquer un joueur comme présent ou absent. Les
              départs annulent les matchs ouverts et remboursent les mises.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Rechercher un joueur..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              {filtered.map((p) => {
                const on = presentPlayerIds.has(p.id);
                const sessionCount = sessionGamesByPlayer.get(p.id) ?? 0;
                const form = on ? playerForms[p.id] : undefined;
                const badge =
                  form?.kind === "goat"
                    ? { icon: <Trophy className="h-3 w-3" />, title: `${form.streak} victoires d'affilée` }
                    : form?.kind === "roast"
                    ? { icon: <span className="text-xs">💀</span>, title: `${form.streak} défaites d'affilée` }
                    : null;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(p.id)}
                    disabled={setPresence.isPending || startSession.isPending}
                    className={[
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors",
                      on
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground hover:bg-muted/80",
                    ].join(" ")}
                    title={badge?.title}
                  >
                    {badge && <span className="flex items-center">{badge.icon}</span>}
                    {displayName(p)}
                    <span className="text-xs opacity-70">{p.elo}</span>
                    {on && (
                      <span className="rounded-full bg-primary-foreground/20 px-1.5 text-[10px] font-semibold tabular-nums">
                        {sessionCount}
                      </span>
                    )}
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="py-4 text-sm text-muted-foreground">Aucun joueur trouvé.</p>
              )}
            </div>
            <div className="flex flex-col items-stretch gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-muted-foreground">
                {presentPlayerIds.size} présent{presentPlayerIds.size > 1 ? "s" : ""}
              </span>
              <div className="flex flex-wrap gap-2">
                {canGenerate && (
                  <Button
                    variant="outline"
                    onClick={() => requireAdmin(regenerate)}
                    disabled={
                      cancelAllOpen.isPending ||
                      createProposed.isPending ||
                      startSession.isPending
                    }
                  >
                    <Shuffle className="h-4 w-4" />
                    Régénérer la suite
                  </Button>
                )}
                <Button
                  onClick={() => requireAdmin(generate)}
                  disabled={
                    !canGenerate ||
                    createProposed.isPending ||
                    startSession.isPending
                  }
                >
                  <Shuffle className="h-4 w-4" />
                  Générer les matchs
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Matchs proposés ({openSessionMatches.length} ouverts)
            </CardTitle>
            <CardDescription>
              Équipes équilibrées par Elo. Les joueurs qui ont le moins joué passent en priorité.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {openSessionMatches.length === 0 && playedSessionMatches.length === 0 ? (
              <p className="rounded-md bg-muted p-6 text-center text-sm text-muted-foreground">
                Sélectionnez au moins 4 joueurs présents puis cliquez sur « Générer les matchs ».
              </p>
            ) : (
              <div className="space-y-4">
                {openSessionMatches.length > 0 && (
                  <ol className="space-y-2">
                    {openSessionMatches.map((m, i) => (
                      <SessionMatchCard
                        key={m.id}
                        match={m}
                        index={i}
                        onCancel={() => requireAdmin(() => cancelProposed.mutate(m.id))}
                        onRecord={() => requireAdmin(() => setToRecord(m))}
                      />
                    ))}
                  </ol>
                )}
                {playedSessionMatches.length > 0 && (
                  <section>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Matchs joués ({playedSessionMatches.length})
                    </h3>
                    <ol className="space-y-1">
                      {playedSessionMatches.map((m) => {
                        const played = m.match_id ? sessionMatchById.get(m.match_id) : null;
                        return (
                          <SessionMatchCard
                            key={m.id}
                            match={m}
                            compact
                            scoreA={played?.score_a}
                            scoreB={played?.score_b}
                            onCancel={() => {}}
                            onRecord={() => {}}
                            onEdit={
                              unlocked && m.match_id
                                ? () => setToEdit(m)
                                : undefined
                            }
                          />
                        );
                      })}
                    </ol>
                  </section>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {rivalries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Swords className="h-5 w-5" />
              Revanches et belles en attente
            </CardTitle>
            <CardDescription>
              Face-à-face récents entre joueurs présents. Cliquez pour ouvrir les paris.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {rivalries.map((r) => (
                <li
                  key={r.key}
                  className="grid grid-cols-[auto,1fr,auto,1fr,auto] items-center gap-2 rounded-xl bg-muted/40 p-3 text-sm"
                >
                  <Badge variant={r.kind === "belle" ? "accent" : r.kind === "rivalite" ? "secondary" : "default"}>
                    {rivalryLabel(r)}
                  </Badge>
                  <span className="font-medium">{r.teamA.map((p) => displayName(p)).join(" & ")}</span>
                  <span className="text-xs font-semibold text-muted-foreground">VS</span>
                  <span className="font-medium">{r.teamB.map((p) => displayName(p)).join(" & ")}</span>
                  {unlocked ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openRivalryBetting(r)}
                      disabled={createProposed.isPending}
                      title="Ouvrir les paris"
                    >
                      <Coins className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <span />
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <DailyHistory />

      <RecordSessionMatchDialog
        match={toRecord}
        sessionId={sessionId}
        targetScore={active?.session.target_score}
        onClose={() => setToRecord(null)}
      />

      <EditMatchDialog
        open={!!toEdit && !!editMatchRow}
        matchId={toEdit?.match_id ?? null}
        teamALabel={toEdit ? labelFor(toEdit, "A") : ""}
        teamBLabel={toEdit ? labelFor(toEdit, "B") : ""}
        initialScoreA={editMatchRow?.score_a ?? 0}
        initialScoreB={editMatchRow?.score_b ?? 0}
        onClose={() => setToEdit(null)}
      />

      <Dialog open={!!toLeave} onOpenChange={(o) => !o && setToLeave(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retirer ce joueur du tournoi ?</DialogTitle>
            <DialogDescription>
              Ce joueur a des matchs ouverts. Ceux-ci seront annulés et toutes les mises remboursées. Les matchs non concernés restent intacts.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToLeave(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={confirmLeave} disabled={setPresence.isPending}>
              Retirer le joueur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SessionMatchCard({
  match,
  index,
  compact,
  scoreA,
  scoreB,
  onCancel,
  onRecord,
  onEdit,
}: {
  match: ProposedMatchWithPlayers;
  index?: number;
  compact?: boolean;
  scoreA?: number;
  scoreB?: number;
  onCancel: () => void;
  onRecord: () => void;
  onEdit?: () => void;
}) {
  const eloGap = Math.abs(match.elo_a - match.elo_b);
  const teamALabel = labelFor(match, "A");
  const teamBLabel = labelFor(match, "B");
  const isOpen = match.status === "open";
  const hasScore = typeof scoreA === "number" && typeof scoreB === "number";
  return (
    <li className="space-y-2 rounded-xl bg-muted/40 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={isOpen ? "outline" : "secondary"} className="font-mono">
          {isOpen ? `#${(index ?? 0) + 1}` : "✓"}
        </Badge>
        <div className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium">{teamALabel}</span>
          {hasScore ? (
            <span className="font-mono text-xs font-semibold tabular-nums text-muted-foreground">
              {scoreA}–{scoreB}
            </span>
          ) : (
            <span className="text-xs font-semibold text-muted-foreground">VS</span>
          )}
          <span className="font-medium">{teamBLabel}</span>
          {!compact && <Badge variant={eloGap < 80 ? "secondary" : "accent"}>Δ{eloGap}</Badge>}
        </div>
        {isOpen && (
          <div className="flex items-center gap-1">
            <Button
              variant="default"
              size="sm"
              onClick={onRecord}
              title="Saisir le score"
              className="h-10"
            >
              <PlayCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Saisir le score</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onCancel}
              title="Supprimer ce match (remboursement des mises)"
              className="h-10 w-10"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )}
        {!isOpen && onEdit && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onEdit}
            title="Corriger le score (recalcul Elo)"
            className="h-9 w-9"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </div>
      <MatchBettingInline match={match} />
    </li>
  );
}

function labelFor(m: ProposedMatchWithPlayers, side: "A" | "B"): string {
  const fmt = (p: { first_name: string; nickname?: string | null } | null | undefined) =>
    p ? displayName(p) : "?";
  if (side === "A") {
    if (m.mode === "individual") return fmt(m.team_a_p1_player);
    return `${fmt(m.team_a_p1_player)} & ${fmt(m.team_a_p2_player)}`;
  }
  if (m.mode === "individual") return fmt(m.team_b_p1_player);
  return `${fmt(m.team_b_p1_player)} & ${fmt(m.team_b_p2_player)}`;
}

