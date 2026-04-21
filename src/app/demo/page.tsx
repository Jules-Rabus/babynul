"use client";

import Link from "next/link";
import { Sparkles, Home } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { displayName } from "@/lib/player-display";
import { DEMO_PLAYERS, DEMO_SESSION, DEMO_MATCHES } from "@/lib/demo/fixtures";

export default function DemoPage() {
  const leaderboard = [...DEMO_PLAYERS].sort((a, b) => b.elo - a.elo);
  const topGames = [...DEMO_PLAYERS].sort((a, b) => b.games_played - a.games_played).slice(0, 3);
  const recent = [...DEMO_MATCHES]
    .sort((a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime())
    .slice(0, 6);
  const byId = new Map(DEMO_PLAYERS.map((p) => [p.id, p]));

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
            <Sparkles className="h-7 w-7" />
            Mode démo
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Données fictives pour présenter Babynul sans avoir besoin d&apos;une BDD. L&apos;app réelle tourne sur Supabase.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium hover:bg-muted/80"
        >
          <Home className="h-3.5 w-3.5" />
          Aller à l&apos;app
        </Link>
      </header>

      <div className="mb-4 rounded-xl bg-amber-500/15 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
        🎭 Toutes les données ci-dessous sont fictives — aucune requête réseau n&apos;est envoyée.
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Soirée en cours</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium">{DEMO_SESSION.label}</p>
            <p className="text-xs text-muted-foreground">
              Démarrée à{" "}
              {new Date(DEMO_SESSION.started_at).toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              · {DEMO_SESSION.participants.length} présents
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {DEMO_SESSION.participants.map((p) => (
                <Badge key={p.id} variant="outline">
                  {displayName(p)}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Elo</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-1.5 text-sm">
              {leaderboard.slice(0, 5).map((p, i) => (
                <li key={p.id} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                      {i + 1}
                    </span>
                    {displayName(p)}
                  </span>
                  <span className="tabular-nums font-semibold">{p.elo}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Les plus actifs</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              {topGames.map((p) => (
                <li key={p.id} className="flex items-center justify-between">
                  <span>{displayName(p)}</span>
                  <span className="tabular-nums text-muted-foreground">{p.games_played} parties</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Derniers matchs</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              {recent.map((m) => {
                const a = byId.get(m.teamA[0]);
                const b = byId.get(m.teamB[0]);
                return (
                  <li key={m.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">
                      {a ? displayName(a) : "?"} {m.score_a} – {m.score_b} {b ? displayName(b) : "?"}
                    </span>
                    <Badge variant={m.winner_side === "A" ? "default" : "secondary"}>
                      {m.winner_side === "A" ? "A" : "B"}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>

      <section className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Features</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <Feature title="Matchmaking équitable">
              Priorité aux joueurs qui ont le moins joué dans la soirée, pas dans l&apos;historique.
            </Feature>
            <Feature title="Voice mode IA">
              Après chaque score, une phrase drôle en français annonce le prochain match. Gemini 3.1 Flash TTS + fallback OpenAI.
            </Feature>
            <Feature title="Mode Roast / GOAT">
              3 défaites d&apos;affilée → le speaker te chambre. 3 victoires → il te couronne 🐐. Basé sur la forme en session.
            </Feature>
            <Feature title="Paris avec cotes Elo">
              Chaque joueur parie des points fictifs. Les cotes sont calculées à partir de l&apos;Elo.
            </Feature>
            <Feature title="Départs en cours de soirée">
              Un joueur part ? Ses matchs ouverts sont annulés, les mises remboursées, tout se recale.
            </Feature>
            <Feature title="Surnoms">
              Chaque joueur peut avoir un surnom (Le Goat, La Machine…), utilisé dans les annonces vocales.
            </Feature>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function Feature({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{children}</p>
    </div>
  );
}
