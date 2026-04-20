"use client";

import { useState } from "react";
import { Dice6, Plus, Trash2, CheckCircle2, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAdmin } from "@/components/admin-context";
import {
  useBets,
  useBetVotes,
  useCloseBet,
  useCreateBet,
  useDeleteBet,
  useMyVote,
  useVote,
  type BetRow,
} from "@/lib/queries/bets";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function BetsPanel() {
  const { unlocked } = useAdmin();
  const { data: bets = [], isLoading } = useBets();

  return (
    <div className="space-y-4">
      {unlocked && <NewBetForm />}

      {isLoading ? (
        <div className="h-32 animate-pulse rounded-xl bg-muted" />
      ) : bets.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Aucun pari pour l&apos;instant. {unlocked ? "Créez-en un !" : "Revenez plus tard."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {bets.map((bet) => (
            <BetCard key={bet.id} bet={bet} />
          ))}
        </div>
      )}
    </div>
  );
}

function NewBetForm() {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const create = useCreateBet();

  const updateOpt = (i: number, v: string) => {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? v : o)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim()) return toast.error("Question requise.");
    if (cleaned.length < 2) return toast.error("Au moins 2 options requises.");
    try {
      await create.mutateAsync({ question: question.trim(), options: cleaned });
      toast.success("Pari créé.");
      setQuestion("");
      setOptions(["", ""]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Nouveau pari
        </CardTitle>
        <CardDescription>Posez une question, 2 à 6 options.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="question">Question</Label>
            <Input
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Qui sera premier au classement vendredi ?"
            />
          </div>
          <div className="space-y-2">
            <Label>Options</Label>
            {options.map((o, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={o}
                  onChange={(e) => updateOpt(i, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                />
                {options.length > 2 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {options.length < 6 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOptions((prev) => [...prev, ""])}
              >
                <Plus className="h-4 w-4" />
                Ajouter une option
              </Button>
            )}
          </div>
          <Button type="submit" disabled={create.isPending} className="w-full">
            {create.isPending ? "Création..." : "Créer le pari"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function BetCard({ bet }: { bet: BetRow }) {
  const { unlocked } = useAdmin();
  const { data: votes = [] } = useBetVotes(bet.id);
  const { data: myVote } = useMyVote(bet.id);
  const vote = useVote(bet.id);
  const closeBet = useCloseBet();
  const deleteBet = useDeleteBet();

  const counts = bet.options.map((_, i) => votes.filter((v) => v.option_index === i).length);
  const total = counts.reduce((s, c) => s + c, 0);

  const handleVote = (idx: number) => {
    if (!bet.active) return;
    vote.mutate(idx, {
      onSuccess: () => toast.success("Vote enregistré."),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Erreur."),
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="flex-1">
          <CardTitle className="flex items-center gap-2">
            <Dice6 className="h-5 w-5" />
            {bet.question}
          </CardTitle>
          <CardDescription className="flex items-center gap-2 pt-1">
            {bet.active ? (
              <Badge>Ouvert · {total} vote{total > 1 ? "s" : ""}</Badge>
            ) : (
              <Badge variant="secondary">Clôturé · {total} vote{total > 1 ? "s" : ""}</Badge>
            )}
          </CardDescription>
        </div>
        {unlocked && (
          <div className="flex gap-1">
            {bet.active && (
              <Button
                variant="outline"
                size="icon"
                aria-label="Clôturer le pari"
                onClick={() => closeBet.mutate(bet.id)}
              >
                <CheckCircle2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Supprimer le pari"
              onClick={() => {
                if (confirm("Supprimer ce pari et tous les votes ?")) deleteBet.mutate(bet.id);
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {bet.options.map((opt, i) => {
          const count = counts[i];
          const pct = total === 0 ? 0 : Math.round((count / total) * 100);
          const selected = myVote === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => handleVote(i)}
              disabled={!bet.active}
              className={cn(
                "group relative w-full overflow-hidden rounded-lg p-3 text-left transition-colors",
                selected ? "bg-primary/20 ring-2 ring-primary" : "bg-muted hover:bg-muted/70",
                !bet.active && "cursor-not-allowed opacity-80",
              )}
            >
              <div
                className="absolute inset-y-0 left-0 bg-primary/15 transition-all"
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex items-center justify-between gap-2 text-sm">
                <span className="font-medium">{opt}</span>
                <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                  {count} · {pct}%
                </span>
              </div>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
