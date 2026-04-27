"use client";

import { useState } from "react";
import { ChevronDown, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePlaceWager, useWagers, type ProposedMatchWithPlayers, type WagerRow } from "@/lib/queries/wagers";
import { eloOdds } from "@/lib/elo";
import { useCurrentPlayer } from "@/hooks/use-current-player";
import { cn } from "@/lib/utils";
import { displayName } from "@/lib/player-display";
import { toast } from "sonner";

type Props = {
  match: ProposedMatchWithPlayers;
  defaultOpen?: boolean;
  className?: string;
};

export function MatchBettingInline({ match, defaultOpen = false, className }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const { data: wagers = [] } = useWagers(match.id);
  const { me } = useCurrentPlayer();

  const oddsA = eloOdds(match.elo_a, match.elo_b);
  const oddsB = eloOdds(match.elo_b, match.elo_a);

  const teamALabel = labelFor(match, "A");
  const teamBLabel = labelFor(match, "B");

  const poolA = wagers.filter((w) => w.side === "A").reduce((s, w) => s + w.stake, 0);
  const poolB = wagers.filter((w) => w.side === "B").reduce((s, w) => s + w.stake, 0);
  const countA = wagers.filter((w) => w.side === "A").length;
  const countB = wagers.filter((w) => w.side === "B").length;
  const myWager = me ? wagers.find((w) => w.player_id === me.id) ?? null : null;

  const isOpen = match.status === "open";
  if (!isOpen) {
    // Cas résolu / annulé : affichage simple, non dépliable.
    return (
      <div className={cn("rounded-lg bg-muted/30 p-2 text-xs", className)}>
        <ResultLine match={match} wagers={wagers} currentPlayerId={me?.id ?? null} />
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg bg-muted/30", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted/50"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Coins className="h-3.5 w-3.5" />
          Paris
        </span>
        <span className="flex flex-1 items-center justify-end gap-2 text-xs tabular-nums">
          <Badge variant="outline" className="tabular-nums">
            A ×{oddsA.toFixed(2)}
          </Badge>
          <Badge variant="outline" className="tabular-nums">
            B ×{oddsB.toFixed(2)}
          </Badge>
          <ChevronDown
            className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-border px-3 py-3">
          <div className="grid grid-cols-2 gap-2">
            <PoolLine label={teamALabel} odds={oddsA} pool={poolA} count={countA} />
            <PoolLine label={teamBLabel} odds={oddsB} pool={poolB} count={countB} />
          </div>
          <BetForm
            match={match}
            oddsA={oddsA}
            oddsB={oddsB}
            teamALabel={teamALabel}
            teamBLabel={teamBLabel}
            myWager={myWager}
          />
        </div>
      )}
    </div>
  );
}

function PoolLine({
  label,
  odds,
  pool,
  count,
}: {
  label: string;
  odds: number;
  pool: number;
  count: number;
}) {
  return (
    <div className="rounded-md bg-background/60 p-2 ring-1 ring-border">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium">{label}</span>
        <Badge variant="outline" className="tabular-nums text-[11px]">
          ×{odds.toFixed(2)}
        </Badge>
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>{count} pari{count > 1 ? "s" : ""}</span>
        <span className="tabular-nums">{pool} pts</span>
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
  myWager,
}: {
  match: ProposedMatchWithPlayers;
  oddsA: number;
  oddsB: number;
  teamALabel: string;
  teamBLabel: string;
  myWager: WagerRow | null;
}) {
  const { me } = useCurrentPlayer();
  const [side, setSide] = useState<"A" | "B">(myWager?.side ?? "A");
  const [stake, setStake] = useState<string>(String(myWager?.stake ?? 100));
  const place = usePlaceWager(match.id);

  if (!me) {
    return (
      <p className="rounded-md bg-background/60 p-2 text-xs text-muted-foreground ring-1 ring-border">
        Choisissez votre profil en haut pour parier.
      </p>
    );
  }

  const amount = Number(stake);
  const validAmount = !Number.isNaN(amount) && amount > 0;
  const chosenOdds = side === "A" ? oddsA : oddsB;
  const potentialWin = validAmount ? Math.round(amount * chosenOdds) : 0;

  const handleBet = async () => {
    if (!validAmount) {
      toast.error("Mise invalide.");
      return;
    }
    try {
      await place.mutateAsync({ playerId: me.id, side, stake: amount });
      toast.success(`${amount} pts sur ${side === "A" ? teamALabel : teamBLabel}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur.");
    }
  };

  return (
    <div className="space-y-2">
      {myWager && (
        <p className="rounded-md bg-accent/15 p-2 text-[11px]">
          Mise actuelle : <strong className="tabular-nums">{myWager.stake} pts</strong> sur{" "}
          {myWager.side === "A" ? teamALabel : teamBLabel} (×{Number(myWager.odds).toFixed(2)}). Une
          nouvelle mise remplace l&apos;ancienne.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          size="sm"
          variant={side === "A" ? "default" : "outline"}
          onClick={() => setSide("A")}
          className="h-10 justify-start truncate"
        >
          {teamALabel}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={side === "B" ? "default" : "outline"}
          onClick={() => setSide("B")}
          className="h-10 justify-start truncate"
        >
          {teamBLabel}
        </Button>
      </div>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label htmlFor={`stake-${match.id}`} className="text-[11px]">
            Mise (solde {me.wager_balance} pts)
          </Label>
          <Input
            id={`stake-${match.id}`}
            type="number"
            inputMode="numeric"
            min="1"
            max={me.wager_balance}
            value={stake}
            onChange={(e) => setStake(e.target.value)}
            className="mt-1 h-10 tabular-nums"
          />
        </div>
        <Button
          onClick={handleBet}
          disabled={place.isPending || !validAmount}
          size="lg"
          className="h-10"
        >
          Parier · {potentialWin} pts
        </Button>
      </div>
    </div>
  );
}

function ResultLine({
  match,
  wagers,
  currentPlayerId,
}: {
  match: ProposedMatchWithPlayers;
  wagers: WagerRow[];
  currentPlayerId: string | null;
}) {
  if (match.status === "cancelled") {
    return <span className="text-muted-foreground">Match annulé — mises remboursées.</span>;
  }
  if (!currentPlayerId) {
    return (
      <span className="text-muted-foreground">
        Gagnant : {match.winner_side === "A" ? labelFor(match, "A") : labelFor(match, "B")}
      </span>
    );
  }
  const mine = wagers.find((w) => w.player_id === currentPlayerId);
  if (!mine) {
    return (
      <span className="text-muted-foreground">
        Pas de pari placé. Gagnant :{" "}
        {match.winner_side === "A" ? labelFor(match, "A") : labelFor(match, "B")}
      </span>
    );
  }
  if (mine.status === "won") {
    return (
      <span>
        ✅ Gagné <strong className="tabular-nums">{mine.payout ?? 0} pts</strong>.
      </span>
    );
  }
  if (mine.status === "lost") {
    return <span>❌ Mise de {mine.stake} pts perdue.</span>;
  }
  return <span>↩️ Mise remboursée.</span>;
}

export function labelFor(m: ProposedMatchWithPlayers, side: "A" | "B"): string {
  const fmt = (
    p: { first_name: string; nickname?: string | null } | null | undefined,
  ) => (p ? displayName(p) : "?");
  if (side === "A") {
    if (m.mode === "individual") return fmt(m.team_a_p1_player);
    return `${fmt(m.team_a_p1_player)} & ${fmt(m.team_a_p2_player)}`;
  }
  if (m.mode === "individual") return fmt(m.team_b_p1_player);
  return `${fmt(m.team_b_p1_player)} & ${fmt(m.team_b_p2_player)}`;
}
