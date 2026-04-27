"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScoreStepper } from "@/components/ui/score-stepper";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePlayers } from "@/lib/queries/players";
import { useRecordMatch } from "@/lib/queries/matches";
import { useAdmin } from "@/components/admin-context";
import { UndoLastMatch } from "./undo-last-match";
import { expectedScore } from "@/lib/elo";
import { displayName } from "@/lib/player-display";
import { toast } from "sonner";
import { fireVictoryEffects } from "@/lib/effects";

type Mode = "individual" | "team";

export function RecordMatchForm() {
  const { unlocked } = useAdmin();
  const { data: players = [] } = usePlayers();
  const record = useRecordMatch();

  const [mode, setMode] = useState<Mode>("individual");
  const [a1, setA1] = useState<string>("");
  const [a2, setA2] = useState<string>("");
  const [b1, setB1] = useState<string>("");
  const [b2, setB2] = useState<string>("");
  const [targetScore, setTargetScore] = useState<number>(10);
  const [scoreA, setScoreA] = useState<number>(10);
  const [scoreB, setScoreB] = useState<number>(0);

  const reset = () => {
    setA1("");
    setA2("");
    setB1("");
    setB2("");
    setScoreA(targetScore);
    setScoreB(0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlocked) {
      toast.error("Entrez le code admin pour enregistrer un match.");
      return;
    }

    const sA = scoreA;
    const sB = scoreB;
    if (sA < 0 || sB < 0) {
      toast.error("Scores invalides.");
      return;
    }
    if (sA === sB) {
      toast.error("Un vainqueur est requis (pas de match nul).");
      return;
    }
    if (Math.max(sA, sB) !== targetScore) {
      toast.error(`Le gagnant doit atteindre ${targetScore}.`);
      return;
    }

    if (mode === "individual") {
      if (!a1 || !b1 || a1 === b1) {
        toast.error("Sélectionnez 2 joueurs différents.");
        return;
      }
    } else {
      const ids = [a1, a2, b1, b2];
      if (ids.some((x) => !x)) {
        toast.error("Sélectionnez les 4 joueurs.");
        return;
      }
      if (new Set(ids).size !== 4) {
        toast.error("Les 4 joueurs doivent être différents.");
        return;
      }
    }

    try {
      await record.mutateAsync({
        mode,
        a1,
        a2: mode === "team" ? a2 : null,
        b1,
        b2: mode === "team" ? b2 : null,
        scoreA: sA,
        scoreB: sB,
      });
      toast.success("Match enregistré.");
      void fireVictoryEffects();
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'enregistrement.");
    }
  };

  const playerOptions = players.map((p) => (
    <SelectItem key={p.id} value={p.id}>
      {displayName(p)} ({p.elo})
    </SelectItem>
  ));

  const prediction = useMemo(() => {
    const byId = new Map(players.map((p) => [p.id, p.elo]));
    const eloFor = (ids: string[]) => {
      const values = ids.map((id) => byId.get(id)).filter((v): v is number => typeof v === "number");
      if (values.length === 0) return null;
      return Math.round(values.reduce((s, v) => s + v, 0) / values.length);
    };
    const teamAIds = mode === "individual" ? [a1] : [a1, a2];
    const teamBIds = mode === "individual" ? [b1] : [b1, b2];
    if (teamAIds.some((x) => !x) || teamBIds.some((x) => !x)) return null;
    const eloA = eloFor(teamAIds);
    const eloB = eloFor(teamBIds);
    if (eloA === null || eloB === null) return null;
    const probA = expectedScore(eloA, eloB);
    return { eloA, eloB, probA, probB: 1 - probA };
  }, [players, mode, a1, a2, b1, b2]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <CardTitle>Saisir un match</CardTitle>
        <UndoLastMatch />
      </CardHeader>
      <CardContent>
        {!unlocked && (
          <p className="mb-4 rounded-md bg-muted p-3 text-sm text-muted-foreground">
            Cliquez sur <span className="font-semibold">Débloquer</span> en haut et entrez le code admin
            pour enregistrer des résultats.
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === "individual" ? "default" : "outline"}
              onClick={() => setMode("individual")}
            >
              1 vs 1
            </Button>
            <Button
              type="button"
              variant={mode === "team" ? "default" : "outline"}
              onClick={() => setMode("team")}
            >
              2 vs 2
            </Button>
          </div>

          <div className="space-y-2 rounded-xl bg-muted/40 p-3">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Score cible
            </Label>
            <div className="flex flex-wrap gap-2">
              {[3, 5, 7, 10].map((t) => (
                <Button
                  key={t}
                  type="button"
                  size="sm"
                  variant={targetScore === t ? "default" : "outline"}
                  onClick={() => {
                    setTargetScore(t);
                    setScoreA(t);
                    setScoreB(0);
                  }}
                >
                  {t} pts
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3 rounded-xl bg-muted/50 p-4">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Équipe A</Label>
              <PlayerSelect value={a1} onChange={setA1}>
                {playerOptions}
              </PlayerSelect>
              {mode === "team" && (
                <PlayerSelect value={a2} onChange={setA2}>
                  {playerOptions}
                </PlayerSelect>
              )}
              <ScoreStepper
                id="scoreA"
                label="Score A"
                value={scoreA}
                onChange={setScoreA}
                max={targetScore}
              />
            </div>

            <div className="space-y-3 rounded-xl bg-muted/50 p-4">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Équipe B</Label>
              <PlayerSelect value={b1} onChange={setB1}>
                {playerOptions}
              </PlayerSelect>
              {mode === "team" && (
                <PlayerSelect value={b2} onChange={setB2}>
                  {playerOptions}
                </PlayerSelect>
              )}
              <ScoreStepper
                id="scoreB"
                label="Score B"
                value={scoreB}
                onChange={setScoreB}
                max={targetScore}
              />
            </div>
          </div>

          {prediction && (
            <div className="rounded-xl bg-muted/50 p-3 text-sm">
              <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
                <span>Prédiction avant match</span>
                <span className="tabular-nums">
                  {prediction.eloA} vs {prediction.eloB}
                </span>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="bg-primary transition-all"
                  style={{ width: `${prediction.probA * 100}%` }}
                />
                <div
                  className="bg-accent transition-all"
                  style={{ width: `${prediction.probB * 100}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-xs font-medium">
                <span>Équipe A — {Math.round(prediction.probA * 100)}%</span>
                <span>Équipe B — {Math.round(prediction.probB * 100)}%</span>
              </div>
            </div>
          )}

          <Button type="submit" size="lg" disabled={!unlocked || record.isPending} className="w-full">
            {record.isPending ? "Enregistrement..." : "Enregistrer le match"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PlayerSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Choisir un joueur" />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}
