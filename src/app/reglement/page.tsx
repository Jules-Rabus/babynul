import Link from "next/link";
import { Ban, Beer, Flame, Mic2, Trophy, Home, ScrollText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Règlement — Babynul !",
  description: "Les règles de base du baby-foot + les règles maison non-négociables.",
};

type Rule = { text: string; punchline?: string };

const BASIC_RULES: Rule[] = [
  {
    text: "2v2 ou 1v1, on joue en 10 points. 2 points d'écart, sinon on continue jusqu'à ce que quelqu'un craque.",
  },
  {
    text: "Balle sortie → remise en jeu par celui qui l'a perdue, sur sa ligne de défense.",
  },
  {
    text: "But gag (rebond bizarre qui finit dans la cage) : ça compte. Arrête de chialer.",
    punchline: "Le flipper fait partie du jeu.",
  },
  {
    text: "Changement de côté à la mi-temps si vous êtes 3+. Sinon : courage et endurance.",
  },
  {
    text: "Un joueur ne touche JAMAIS les barres adverses. Main sur les deux rouges ou les deux bleues, pas les deux.",
  },
];

const HOUSE_RULES: Rule[] = [
  {
    text: "Roulette interdite.",
    punchline: "On n'est pas au PMU. Défenseur ou milieu qui fait tourner 360° → balle à l'adverse.",
  },
  {
    text: "Pas de demi-but.",
    punchline: "Sauf si t'es au bar. Dans ce cas c'est toléré une fois par personne par soirée.",
  },
  {
    text: "Pas de « coup droit bouchon » collé à la paroi.",
    punchline: "Si tu marques comme ça, tu payes la tournée. Règle du bon goût.",
  },
  {
    text: "Interdiction de secouer la table.",
    punchline: "Même si tu perds. Surtout si tu perds.",
  },
  {
    text: "La volée à 2 barres est tolérée si c'est beau.",
    punchline: "Si c'est moche : rejouée. Le jury (les spectateurs) tranche.",
  },
  {
    text: "Le gardien adverse ne peut pas parler pendant ton tir.",
    punchline: "Sinon c'est coaching illégal. Carton jaune oral.",
  },
];

const TRASH_TALK: Rule[] = [
  {
    text: "Chambrer est autorisé.",
    punchline: "Recommandé, même.",
  },
  {
    text: "Mais chambre bien.",
    punchline: "Le français approximatif est disqualifié d'office par le président de séance.",
  },
  {
    text: "Chambrage silencieux interdit.",
    punchline: "Si tu souris narquoisement pendant 30 secondes sans rien dire, tu payes un tacos.",
  },
];

const BAR_RULES: Rule[] = [
  {
    text: "Toute partie commencée avec une boisson doit se terminer avec la même.",
    punchline: "Ou pire. Jamais mieux.",
  },
  {
    text: "Match sec : interdit avant 19h.",
    punchline: "Règle Jules. Non-négociable.",
  },
  {
    text: "Le perdant sert le coup suivant.",
    punchline: "C'est la loi du parquet.",
  },
];

const VOICE_RULES: Rule[] = [
  {
    text: "Si le speaker se moque de toi, c'est que tu as perdu 3 fois d'affilée.",
    punchline: "Courage, champion. Le bas est la base du haut.",
  },
  {
    text: "Si le speaker te couronne 🐐, fais gaffe.",
    punchline: "La chute sera terrible. L'histoire l'a prouvé.",
  },
  {
    text: "Couper le mode vocal pendant qu'il t'annonce est considéré comme un forfait moral.",
  },
];

function Section({
  title,
  icon: Icon,
  rules,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  rules: Rule[];
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
          {rules.map((r, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span
                className="mt-[0.4em] h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                aria-hidden
              />
              <div className="flex-1">
                <p className="font-medium">{r.text}</p>
                {r.punchline && (
                  <p className="mt-0.5 text-xs italic text-muted-foreground">
                    {r.punchline}
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

export default function ReglementPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
            <ScrollText className="h-7 w-7" />
            Règlement Babynul
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Les règles de base du baby-foot + les règles maison non-négociables.
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
        <Section title="Règles de base" icon={Trophy} rules={BASIC_RULES} />
        <Section title="Règles maison" icon={Ban} rules={HOUSE_RULES} />
        <Section title="Trash talk" icon={Flame} rules={TRASH_TALK} />
        <Section title="Mode bar" icon={Beer} rules={BAR_RULES} />
        <Section title="Voice mode" icon={Mic2} rules={VOICE_RULES} />
      </div>

      <footer className="mt-10 rounded-xl bg-muted/40 p-4 text-center text-xs text-muted-foreground">
        Règlement évolutif. Toute remarque est à soumettre au président de séance (celui qui a la main sur le joystick).
      </footer>
    </main>
  );
}
