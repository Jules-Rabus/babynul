"use client";

import { Coins, Trophy, X, Crown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdmin } from "@/components/admin-context";
import { useCurrentPlayer } from "@/hooks/use-current-player";
import {
  useCancelProposedMatch,
  useProposedMatches,
  useResolveProposedMatch,
  type ProposedMatchWithPlayers,
} from "@/lib/queries/wagers";
import { usePlayers } from "@/lib/queries/players";
import { cn } from "@/lib/utils";
import { displayName, announceName } from "@/lib/player-display";
import { MatchBettingInline, labelFor } from "./match-betting-inline";

export function WagersPanel() {
  const { me } = useCurrentPlayer();
  const { data: proposed = [], isLoading } = useProposedMatches();

  const openMatches = proposed.filter((m) => m.status === "open");
  const historical = proposed.filter((m) => m.status !== "open").slice(0, 5);

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
      <div className="space-y-3">
        <BettorHeader />

        {isLoading ? (
          <div className="h-24 animate-pulse rounded-xl bg-muted" />
        ) : openMatches.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Aucun pari ouvert pour l&apos;instant.
              <br />
              Un admin peut en ouvrir depuis l&apos;onglet <span className="font-semibold">Matchmaking</span>.
            </CardContent>
          </Card>
        ) : (
          openMatches.map((m) => <ProposedMatchCard key={m.id} match={m} currentPlayerId={me?.id ?? null} />)
        )}

        {historical.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">Derniers résolus</h3>
            {historical.map((m) => (
              <ProposedMatchCard key={m.id} match={m} compact currentPlayerId={me?.id ?? null} />
            ))}
          </section>
        )}
      </div>

      <TipstersLeaderboard />
    </div>
  );
}

function BettorHeader() {
  const { me } = useCurrentPlayer();

  if (!me) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-4 text-sm">
          <Coins className="h-6 w-6 text-muted-foreground" />
          <span className="text-muted-foreground">
            Cliquez sur <strong>&quot;Qui êtes-vous ?&quot;</strong> en haut pour choisir votre profil et parier.
          </span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 py-4">
        <div className="flex items-center gap-3">
          <Coins className="h-6 w-6 text-accent" />
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Solde de {announceName(me)}
            </div>
            <div className="text-2xl font-bold tabular-nums">{me.wager_balance} pts</div>
          </div>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>
            {me.wager_bets_won} / {me.wager_bets_placed} paris gagnés
          </div>
          {me.wager_total_won > 0 && (
            <div className="text-primary">+{me.wager_total_won} pts gagnés au total</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ProposedMatchCard({
  match,
  compact,
}: {
  match: ProposedMatchWithPlayers;
  compact?: boolean;
  currentPlayerId?: string | null;
}) {
  const { unlocked } = useAdmin();
  const cancel = useCancelProposedMatch();
  const resolve = useResolveProposedMatch();

  const teamALabel = labelFor(match, "A");
  const teamBLabel = labelFor(match, "B");
  const isOpen = match.status === "open";
  const winnerLabel = match.winner_side === "A" ? teamALabel : match.winner_side === "B" ? teamBLabel : null;

  return (
    <Card>
      <CardHeader className={cn("flex flex-row items-start justify-between gap-2", compact && "py-3")}>
        <div>
          <CardTitle className={cn("flex items-center gap-2", compact && "text-base")}>
            {teamALabel} <span className="text-muted-foreground text-sm">vs</span> {teamBLabel}
          </CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-2 pt-1">
            <Badge variant="outline">Elo {match.elo_a} vs {match.elo_b}</Badge>
            {isOpen ? (
              <Badge>Paris ouverts</Badge>
            ) : match.status === "resolved" ? (
              <Badge variant="accent">🏆 {winnerLabel}</Badge>
            ) : (
              <Badge variant="secondary">Annulé</Badge>
            )}
          </CardDescription>
        </div>
        {unlocked && isOpen && (
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => resolve.mutate({ proposedMatchId: match.id, winnerSide: "A" })}
              disabled={resolve.isPending}
            >
              A gagne
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => resolve.mutate({ proposedMatchId: match.id, winnerSide: "B" })}
              disabled={resolve.isPending}
            >
              B gagne
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Annuler"
              onClick={() => {
                if (confirm("Annuler ce match ? Les mises seront remboursées.")) cancel.mutate(match.id);
              }}
            >
              <X className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )}
      </CardHeader>
      {!compact && (
        <CardContent>
          <MatchBettingInline match={match} defaultOpen />
        </CardContent>
      )}
    </Card>
  );
}

function TipstersLeaderboard() {
  const { data: players = [] } = usePlayers();
  const top = [...players]
    .filter((p) => p.wager_bets_placed > 0)
    .sort((a, b) => b.wager_balance - a.wager_balance)
    .slice(0, 8);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4" />
          Classement tipsters
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {top.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">Encore aucun pari placé.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Joueur</TableHead>
                <TableHead className="text-right">Solde</TableHead>
                <TableHead className="text-right">Réussite</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {top.map((p, i) => {
                const rate = p.wager_bets_placed ? Math.round((p.wager_bets_won / p.wager_bets_placed) * 100) : 0;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      {i === 0 ? <Crown className="h-4 w-4 text-accent" /> : <span className="text-xs text-muted-foreground">#{i + 1}</span>}
                    </TableCell>
                    <TableCell className="font-medium">{displayName(p)}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.wager_balance}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                      {p.wager_bets_won}/{p.wager_bets_placed} ({rate}%)
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

