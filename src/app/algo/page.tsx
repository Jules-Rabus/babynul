import Link from "next/link";
import { Home, Brain, Sigma, Scale, Trophy, Users, HeartHandshake } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ELO_K,
  ELO_PRESETS,
  CLOSE_MATCH_FACTOR,
  TEAM_CARRY_ALPHA,
  TEAM_CARRY_SPREAD_CAP,
} from "@/lib/elo";
import { PAIR_REPETITION_PENALTY } from "@/lib/matchmaking";

export const metadata = {
  title: "Algorithme — Babynul !",
  description:
    "Comment Babynul calcule l'Elo et équilibre les équipes.",
};

type Item = { text: string; detail?: string };

const ELO_BASE: Item[] = [
  {
    text: `Score attendu : E_A = 1 / (1 + 10^((R_B − R_A) / 400)).`,
    detail:
      "Formule Elo classique. Plus ton Elo dépasse celui de l'adversaire, plus l'algo s'attend à ta victoire.",
  },
  {
    text: `K-factor fixe : K = ${ELO_K}.`,
    detail:
      "Même K pour tout le monde, débutants comme top. Le delta brut c'est K × (résultat − attendu).",
  },
  {
    text: "Presets de départ : faible 800, moyen 1000, fort 1200.",
    detail: `Choisis à la création d'un joueur. Valeurs : ${ELO_PRESETS.faible} / ${ELO_PRESETS.moyen} / ${ELO_PRESETS.fort}.`,
  },
];

const ELO_WEIGHTED: Item[] = [
  {
    text: "Marge de buts : multiplicateur ln(margin + 1).",
    detail:
      "Une victoire 3-2 vaut moins qu'un 3-0. Score identique → delta nul (cas dégénéré ignoré).",
  },
  {
    text: "Dampener favori : 2.2 / (ΔElo / 400 + 2.2).",
    detail:
      "Quand un favori écrase un faible, le delta est tempéré. Inversement, l'upset de l'outsider est amplifié.",
  },
  {
    text: `Closeness : multiplicateur ${CLOSE_MATCH_FACTOR} si la marge vaut 1 (3-2, 10-9...).`,
    detail:
      "Un match gagné/perdu d'un point n'est pas une démo : les deux camps voient leur delta réduit. Conservation préservée (gagnant +X, perdant −X).",
  },
  {
    text: "Delta final = K × ln(margin + 1) × dampener × closeness × (résultat − attendu).",
    detail:
      "Arrondi à l'entier. Appliqué côté joueur ET côté équipe (en 2v2, l'équipe a son propre Elo).",
  },
];

const TEAM_CARRY: Item[] = [
  {
    text: "En 2v2 le delta équipe est redistribué entre les deux coéquipiers.",
    detail:
      "Avant : les deux joueurs prenaient le même delta calculé sur l'Elo moyen — le top portait le boulet sans compensation. Maintenant chacun reçoit sa part selon son écart à la moyenne.",
  },
  {
    text: "Le porteur (Elo > moyenne d'équipe) perd moins quand l'équipe perd.",
    detail:
      "Et gagne plus quand elle gagne. Son partenaire en dessous fait le miroir : c'est lui qui était sous-côté pour cette équipe.",
  },
  {
    text: `Intensité α = ${TEAM_CARRY_ALPHA}, spread borné à ${TEAM_CARRY_SPREAD_CAP} × 400 Elo.`,
    detail:
      "Le facteur appliqué = 1 ± α × (Elo_joueur − Elo_moyen) / 400. Borné pour que les écarts énormes ne donnent pas des facteurs négatifs.",
  },
  {
    text: "Conservation de la masse Elo : delta_top + delta_partenaire = 2 × delta équipe.",
    detail:
      "Ce que le top ne prend pas, le partenaire le prend. Pas d'inflation Elo dans le système.",
  },
];

const MATCHMAKING: Item[] = [
  {
    text: "Sélection des 4 joueurs par priorité.",
    detail:
      "1) moins d'apparitions dans la session de génération · 2) moins de matchs joués dans la session courante · 3) moins de matchs historiques · 4) Elo décroissant en tie-break.",
  },
  {
    text: "Énumération des 3 appariements possibles entre les 4.",
    detail:
      "Pour chaque appariement, on calcule eloGap = |Elo moyen équipe A − Elo moyen équipe B|.",
  },
  {
    text: `Score d'un appariement = eloGap + ${PAIR_REPETITION_PENALTY} × (paires déjà vues).`,
    detail:
      "On garde le score le plus bas. La pénalité force la variété des duos sans laisser le gap d'Elo exploser.",
  },
  {
    text: "Cible par défaut : 1 match × nombre de joueurs présents.",
    detail:
      "Limite dure à 3× la cible pour éviter les boucles si la combinatoire ne converge pas.",
  },
];

function Section({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: Item[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Icon className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {items.map((it, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span
                className="mt-[0.4em] h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                aria-hidden
              />
              <div className="flex-1">
                <p className="font-medium">{it.text}</p>
                {it.detail && (
                  <p className="mt-0.5 text-xs italic text-muted-foreground">
                    {it.detail}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export default function AlgoPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
            <Brain className="h-7 w-7" />
            L&apos;algo Babynul
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Comment l&apos;Elo et le matchmaking sont calculés.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium hover:bg-muted/80"
        >
          <Home className="h-3.5 w-3.5" />
          Retour
        </Link>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Section title="Elo : base" icon={Sigma} items={ELO_BASE} />
        <Section title="Elo pondéré" icon={Scale} items={ELO_WEIGHTED} />
        <Section title="Carry intra-équipe (2v2)" icon={HeartHandshake} items={TEAM_CARRY} />
        <Section title="Matchmaking" icon={Users} items={MATCHMAKING} />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy className="h-5 w-5" />
              Esprit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              L&apos;objectif de l&apos;algo est de récompenser la régularité et
              les belles perfs, pas juste le talent brut.
            </p>
            <p>
              Le matchmaking équilibre les équipes : un top Elo joue souvent
              avec un débutant pour égaliser les moyennes.
            </p>
            <p>
              Pour que ce soit juste pour le top, deux mécanismes compensent :
              le <strong>closeness factor</strong> (matchs serrés moins punis)
              et le <strong>carry intra-équipe</strong> (le porteur perd moins
              quand son partenaire est plus faible).
            </p>
          </CardContent>
        </Card>
      </div>

      <footer className="mt-10 rounded-xl bg-muted/40 p-4 text-center text-xs text-muted-foreground">
        Algo évolutif. Code source : <code className="font-mono">src/lib/elo.ts</code>{" "}
        et <code className="font-mono">src/lib/matchmaking.ts</code>.
      </footer>
    </main>
  );
}
