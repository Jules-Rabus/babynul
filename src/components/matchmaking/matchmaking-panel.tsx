"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { usePlayers } from "@/lib/queries/players";
import { generateMatches, type ProposedMatch } from "@/lib/matchmaking";
import { Shuffle, Users } from "lucide-react";

export function MatchmakingPanel() {
  const { data: players = [] } = usePlayers();
  const [presentIds, setPresentIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [matches, setMatches] = useState<ProposedMatch[]>([]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p) =>
      p.first_name.toLowerCase().includes(q),
    );
  }, [players, search]);

  const toggle = (id: string) => {
    setPresentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const generate = () => {
    const selected = players.filter((p) => presentIds.has(p.id));
    setMatches(generateMatches(selected));
  };

  const canGenerate = presentIds.size >= 4;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr,1.2fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Joueurs présents
          </CardTitle>
          <CardDescription>
            Sélectionnez les joueurs présents aujourd&apos;hui (min. 4).
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
              const on = presentIds.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  className={[
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors",
                    on
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground hover:bg-muted/80",
                  ].join(" ")}
                >
                  {p.first_name}
                  <span className="text-xs opacity-70">{p.elo}</span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="py-4 text-sm text-muted-foreground">Aucun joueur trouvé.</p>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 pt-2">
            <span className="text-sm text-muted-foreground">
              {presentIds.size} présent{presentIds.size > 1 ? "s" : ""}
            </span>
            <Button onClick={generate} disabled={!canGenerate}>
              <Shuffle className="h-4 w-4" />
              Générer la journée
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Matchs proposés</CardTitle>
          <CardDescription>
            Équipes équilibrées par Elo. Chaque joueur apparaît plusieurs fois quand possible.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {matches.length === 0 ? (
            <p className="rounded-md bg-muted p-6 text-center text-sm text-muted-foreground">
              Sélectionnez au moins 4 joueurs puis cliquez sur « Générer la journée ».
            </p>
          ) : (
            <ol className="space-y-2">
              {matches.map((m, i) => (
                <li
                  key={m.id}
                  className="grid grid-cols-[auto,1fr,auto,1fr,auto] items-center gap-2 rounded-xl bg-muted/40 p-3 text-sm"
                >
                  <Badge variant="outline" className="font-mono">
                    #{i + 1}
                  </Badge>
                  <TeamLabel team={m.teamA} />
                  <span className="text-xs font-semibold text-muted-foreground">VS</span>
                  <TeamLabel team={m.teamB} />
                  <Badge variant={m.eloGap < 80 ? "secondary" : "accent"}>Δ{m.eloGap}</Badge>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TeamLabel({ team }: { team: ProposedMatch["teamA"] }) {
  const [a, b] = team.players;
  return (
    <div className="text-sm">
      <div className="font-medium">
        {a.first_name} & {b.first_name}
      </div>
      <div className="text-xs text-muted-foreground">Elo moyen {team.avgElo}</div>
    </div>
  );
}
