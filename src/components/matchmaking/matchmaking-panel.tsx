"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { usePlayers } from "@/lib/queries/players";
import { generateMatches, type ProposedMatch } from "@/lib/matchmaking";
import { Shuffle, Users, Coins, Swords } from "lucide-react";
import { useAdmin } from "@/components/admin-context";
import { useCreateProposedMatch } from "@/lib/queries/wagers";
import { useRecentMatches } from "@/lib/queries/matches";
import { detectRivalries, rivalryLabel, type Rivalry } from "@/lib/rivalries";
import { toast } from "sonner";

export function MatchmakingPanel() {
  const { data: players = [] } = usePlayers();
  const { data: recentMatches = [] } = useRecentMatches(30);
  const { unlocked } = useAdmin();
  const createProposed = useCreateProposedMatch();
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

  const presentPlayers = useMemo(
    () => players.filter((p) => presentIds.has(p.id)),
    [players, presentIds],
  );

  const rivalries = useMemo(
    () => detectRivalries(recentMatches, presentPlayers),
    [recentMatches, presentPlayers],
  );

  const openRivalryBetting = async (r: Rivalry) => {
    const avg = (arr: { elo: number }[]) => Math.round(arr.reduce((s, p) => s + p.elo, 0) / arr.length);
    try {
      await createProposed.mutateAsync({
        mode: r.mode,
        team_a_p1: r.teamA[0].id,
        team_a_p2: r.teamA[1]?.id ?? null,
        team_b_p1: r.teamB[0].id,
        team_b_p2: r.teamB[1]?.id ?? null,
        elo_a: avg(r.teamA),
        elo_b: avg(r.teamB),
      });
      toast.success("Paris ouverts sur ce face-à-face.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur.");
    }
  };

  const openBetting = async (m: ProposedMatch) => {
    const [a1, a2] = m.teamA.players;
    const [b1, b2] = m.teamB.players;
    try {
      await createProposed.mutateAsync({
        mode: "team",
        team_a_p1: a1.id,
        team_a_p2: a2.id,
        team_b_p1: b1.id,
        team_b_p2: b2.id,
        elo_a: m.teamA.avgElo,
        elo_b: m.teamB.avgElo,
      });
      toast.success("Paris ouverts pour ce match.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur.");
    }
  };

  return (
    <div className="space-y-4">
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
                  className="grid grid-cols-[auto,1fr,auto,1fr,auto,auto] items-center gap-2 rounded-xl bg-muted/40 p-3 text-sm"
                >
                  <Badge variant="outline" className="font-mono">
                    #{i + 1}
                  </Badge>
                  <TeamLabel team={m.teamA} />
                  <span className="text-xs font-semibold text-muted-foreground">VS</span>
                  <TeamLabel team={m.teamB} />
                  <Badge variant={m.eloGap < 80 ? "secondary" : "accent"}>Δ{m.eloGap}</Badge>
                  {unlocked ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openBetting(m)}
                      disabled={createProposed.isPending}
                      title="Ouvrir les paris sur ce match"
                    >
                      <Coins className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <span />
                  )}
                </li>
              ))}
            </ol>
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
                <span className="font-medium">{r.teamA.map((p) => p.first_name).join(" & ")}</span>
                <span className="text-xs font-semibold text-muted-foreground">VS</span>
                <span className="font-medium">{r.teamB.map((p) => p.first_name).join(" & ")}</span>
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
