"use client";

import { useState } from "react";
import { Coins, Trophy, X, Crown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  usePlaceWager,
  useProposedMatches,
  useResolveProposedMatch,
  useWagers,
  type ProposedMatchWithPlayers,
  type WagerRow,
} from "@/lib/queries/wagers";
import { usePlayers } from "@/lib/queries/players";
import { eloOdds } from "@/lib/elo";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
              Solde de {me.first_name}
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
  currentPlayerId,
}: {
  match: ProposedMatchWithPlayers;
  compact?: boolean;
  currentPlayerId: string | null;
}) {
  const { unlocked } = useAdmin();
  const { data: wagers = [] } = useWagers(match.id);
  const cancel = useCancelProposedMatch();
  const resolve = useResolveProposedMatch();

  const teamALabel = labelFor(match, "A");
  const teamBLabel = labelFor(match, "B");
  const oddsA = eloOdds(match.elo_a, match.elo_b);
  const oddsB = eloOdds(match.elo_b, match.elo_a);

  const totalStakeA = wagers.filter((w) => w.side === "A").reduce((s, w) => s + w.stake, 0);
  const totalStakeB = wagers.filter((w) => w.side === "B").reduce((s, w) => s + w.stake, 0);

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
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <SideSummary label={teamALabel} odds={oddsA} pool={totalStakeA} wagers={wagers.filter((w) => w.side === "A").length} highlight={match.winner_side === "A"} />
            <SideSummary label={teamBLabel} odds={oddsB} pool={totalStakeB} wagers={wagers.filter((w) => w.side === "B").length} highlight={match.winner_side === "B"} />
          </div>
          {isOpen && (
            <BetForm
              match={match}
              oddsA={oddsA}
              oddsB={oddsB}
              teamALabel={teamALabel}
              teamBLabel={teamBLabel}
              currentPlayerId={currentPlayerId}
              wagers={wagers}
            />
          )}
          {!isOpen && <MyWagerResult wagers={wagers} winnerSide={match.winner_side} currentPlayerId={currentPlayerId} />}
        </CardContent>
      )}
    </Card>
  );
}

function SideSummary({
  label,
  odds,
  pool,
  wagers,
  highlight,
}: {
  label: string;
  odds: number;
  pool: number;
  wagers: number;
  highlight: boolean;
}) {
  return (
    <div className={cn("rounded-xl p-3", highlight ? "bg-primary/15 ring-1 ring-primary" : "bg-muted/40")}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold">{label}</span>
        <Badge variant={highlight ? "default" : "outline"} className="tabular-nums">
          ×{odds.toFixed(2)}
        </Badge>
      </div>
      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
        <span>{wagers} pari{wagers > 1 ? "s" : ""}</span>
        <span className="tabular-nums">{pool} pts misés</span>
      </div>
    </div>
  );
}

function BetForm({
  match,
  oddsA,
  oddsB,
  teamALabel,
  teamBLabel,
  currentPlayerId,
  wagers,
}: {
  match: ProposedMatchWithPlayers;
  oddsA: number;
  oddsB: number;
  teamALabel: string;
  teamBLabel: string;
  currentPlayerId: string | null;
  wagers: WagerRow[];
}) {
  const [side, setSide] = useState<"A" | "B">("A");
  const [stake, setStake] = useState("100");
  const place = usePlaceWager(match.id);
  const { me } = useCurrentPlayer();

  if (!currentPlayerId) {
    return (
      <div className="rounded-xl bg-muted/30 p-3 text-sm text-muted-foreground">
        Choisissez votre profil en haut pour placer un pari.
      </div>
    );
  }

  const myWager = wagers.find((w) => w.player_id === currentPlayerId);

  const handleBet = async () => {
    const amount = Number(stake);
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error("Mise invalide.");
      return;
    }
    try {
      await place.mutateAsync({ playerId: currentPlayerId, side, stake: amount });
      toast.success(`${amount} pts sur ${side === "A" ? teamALabel : teamBLabel}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur.");
    }
  };

  const potentialWin = Math.round(Number(stake || 0) * (side === "A" ? oddsA : oddsB));

  return (
    <div className="rounded-xl bg-muted/30 p-3">
      {myWager && (
        <p className="mb-2 rounded-md bg-accent/15 p-2 text-xs">
          Vous avez déjà misé <strong className="tabular-nums">{myWager.stake} pts</strong> sur{" "}
          {myWager.side === "A" ? teamALabel : teamBLabel} (cote ×{myWager.odds.toFixed(2)}). Une nouvelle mise remplacera l&apos;ancienne.
        </p>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant={side === "A" ? "default" : "outline"}
            onClick={() => setSide("A")}
          >
            {teamALabel}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={side === "B" ? "default" : "outline"}
            onClick={() => setSide("B")}
          >
            {teamBLabel}
          </Button>
        </div>
        <div className="flex-1 min-w-[120px]">
          <Label htmlFor={`stake-${match.id}`} className="text-xs">
            Mise (solde : {me?.wager_balance ?? 0} pts)
          </Label>
          <Input
            id={`stake-${match.id}`}
            type="number"
            min="1"
            max={me?.wager_balance ?? undefined}
            value={stake}
            onChange={(e) => setStake(e.target.value)}
            className="mt-1 h-9"
          />
        </div>
        <Button onClick={handleBet} disabled={place.isPending}>
          Parier · gain {potentialWin} pts
        </Button>
      </div>
    </div>
  );
}

function MyWagerResult({
  wagers,
  winnerSide,
  currentPlayerId,
}: {
  wagers: WagerRow[];
  winnerSide: "A" | "B" | null;
  currentPlayerId: string | null;
}) {
  if (!currentPlayerId) return null;
  const mine = wagers.find((w) => w.player_id === currentPlayerId);
  if (!mine) return null;
  const won = mine.status === "won";
  const refunded = mine.status === "refunded";
  return (
    <div
      className={cn(
        "rounded-xl p-3 text-sm",
        won ? "bg-primary/15 text-foreground" : refunded ? "bg-muted" : "bg-destructive/10 text-foreground",
      )}
    >
      {won && (
        <span>
          ✅ Vous aviez misé {mine.stake} pts sur {mine.side === winnerSide ? "le vainqueur" : ""}. Gain de{" "}
          <strong className="tabular-nums">{mine.payout} pts</strong>.
        </span>
      )}
      {mine.status === "lost" && (
        <span>
          ❌ Vous aviez misé {mine.stake} pts sur le perdant ({mine.side}). Mise perdue.
        </span>
      )}
      {refunded && <span>↩️ Mise remboursée (match annulé).</span>}
    </div>
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
                    <TableCell className="font-medium">{p.first_name}</TableCell>
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

function labelFor(m: ProposedMatchWithPlayers, side: "A" | "B"): string {
  if (side === "A") {
    if (m.mode === "individual") return m.team_a_p1_player?.first_name ?? "?";
    return `${m.team_a_p1_player?.first_name ?? "?"} & ${m.team_a_p2_player?.first_name ?? "?"}`;
  }
  if (m.mode === "individual") return m.team_b_p1_player?.first_name ?? "?";
  return `${m.team_b_p1_player?.first_name ?? "?"} & ${m.team_b_p2_player?.first_name ?? "?"}`;
}
