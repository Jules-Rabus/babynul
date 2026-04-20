"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePlayers } from "@/lib/queries/players";
import { useRecordMatch } from "@/lib/queries/matches";
import { useSession } from "@/hooks/use-session";
import { fullName } from "@/lib/utils";
import { toast } from "sonner";

type Mode = "individual" | "team";

export function RecordMatchForm() {
  const { user } = useSession();
  const { data: players = [] } = usePlayers();
  const record = useRecordMatch();

  const [mode, setMode] = useState<Mode>("individual");
  const [a1, setA1] = useState<string>("");
  const [a2, setA2] = useState<string>("");
  const [b1, setB1] = useState<string>("");
  const [b2, setB2] = useState<string>("");
  const [scoreA, setScoreA] = useState<string>("10");
  const [scoreB, setScoreB] = useState<string>("0");

  const reset = () => {
    setA1("");
    setA2("");
    setB1("");
    setB2("");
    setScoreA("10");
    setScoreB("0");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Connectez-vous pour enregistrer un match.");
      return;
    }

    const sA = Number(scoreA);
    const sB = Number(scoreB);
    if (Number.isNaN(sA) || Number.isNaN(sB) || sA < 0 || sB < 0) {
      toast.error("Scores invalides.");
      return;
    }
    if (sA === sB) {
      toast.error("Un vainqueur est requis (pas de match nul).");
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
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'enregistrement.");
    }
  };

  const playerOptions = players.map((p) => (
    <SelectItem key={p.id} value={p.id}>
      {fullName(p.first_name, p.last_name)} ({p.elo})
    </SelectItem>
  ));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Saisir un match</CardTitle>
      </CardHeader>
      <CardContent>
        {!user && (
          <p className="mb-4 rounded-md bg-muted p-3 text-sm text-muted-foreground">
            Connectez-vous pour enregistrer des résultats.
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

          <div className="grid gap-6 md:grid-cols-2">
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
              <div>
                <Label htmlFor="scoreA" className="text-xs">Score</Label>
                <Input
                  id="scoreA"
                  type="number"
                  min="0"
                  value={scoreA}
                  onChange={(e) => setScoreA(e.target.value)}
                  className="mt-1"
                />
              </div>
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
              <div>
                <Label htmlFor="scoreB" className="text-xs">Score</Label>
                <Input
                  id="scoreB"
                  type="number"
                  min="0"
                  value={scoreB}
                  onChange={(e) => setScoreB(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          <Button type="submit" size="lg" disabled={!user || record.isPending} className="w-full">
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
