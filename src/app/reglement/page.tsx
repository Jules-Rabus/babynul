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
    text: "2v2 ou 1v1, on joue en 10 points. 2 points d'écart, sinon on continue.",
    punchline: "Comme à Roland-Garros : tant qu'il n'y a pas 2 breaks d'écart, on lâche rien.",
  },
  {
    text: "Balle sortie → remise en jeu par celui qui l'a perdue, sur sa ligne de défense.",
    punchline: "Remise en touche du vaincu. L'erreur se paie cash.",
  },
  {
    text: "But gag (rebond bizarre qui finit dans la cage) : ça compte.",
    punchline: "Un but c'est un but. Le poteau fait partie du jeu, la malchance aussi.",
  },
  {
    text: "Changement de côté à la mi-temps si vous êtes 3+.",
    punchline: "Terrain égal, excuses en moins.",
  },
  {
    text: "Un joueur ne touche JAMAIS les barres adverses.",
    punchline: "Chacun son poste. Les polyvalents finissent sur le banc.",
  },
];

const HOUSE_RULES: Rule[] = [
  {
    text: "Roulette interdite.",
    punchline: "Le spectacle, oui. Le cirque, non. Faute technique, balle à l'adverse.",
  },
  {
    text: "Pas de demi-but.",
    punchline: "Un but franc ou rien. Les victoires à moitié, ça marque pas les mémoires.",
  },
  {
    text: "Pas de coup droit bouchon collé à la paroi.",
    punchline: "Anti-jeu sanctionné. Les beaux gestes font les beaux matchs.",
  },
  {
    text: "Interdiction de secouer la table.",
    punchline: "La table est sacrée. Perdre avec classe fait partie du métier.",
  },
  {
    text: "La volée à 2 barres est tolérée si c'est beau.",
    punchline: "Geste propre, les tribunes applaudissent. Sinon, on recommence.",
  },
  {
    text: "Le gardien adverse ne peut pas parler pendant ton tir.",
    punchline: "Coaching interdit pendant l'action. Le banc se tait.",
  },
];

const TRASH_TALK: Rule[] = [
  {
    text: "Chambrer est autorisé.",
    punchline: "Ça fait partie du folklore, au même titre que la troisième mi-temps.",
  },
  {
    text: "Mais chambre bien.",
    punchline: "Le niveau du chambrage reflète le niveau du joueur.",
  },
  {
    text: "Chambrage silencieux interdit.",
    punchline: "Fixer l'adversaire en souriant, c'est de l'intimidation. Avertissement.",
  },
];

const BAR_RULES: Rule[] = [
  {
    text: "Toute partie commencée avec une boisson doit se terminer avec la même.",
    punchline: "La préparation d'avant-match est sacrée. On change pas son régime en plein effort.",
  },
  {
    text: "Match sec : interdit avant 19h.",
    punchline: "Le corps a besoin de récupérer avant l'effort. Tous les préparateurs le confirment.",
  },
  {
    text: "Le perdant sert le coup suivant.",
    punchline: "La troisième mi-temps est une tradition. Elle n'a jamais failli.",
  },
];

const VOICE_RULES: Rule[] = [
  {
    text: "3 défaites d'affilée → le speaker te chambre.",
    punchline: "Les caméras d'après-match sont impitoyables. Faut assumer.",
  },
  {
    text: "3 victoires d'affilée → il te couronne 🐐.",
    punchline: "Mais les favoris chutent aussi. L'histoire du sport en est pleine.",
  },
  {
    text: "Couper le mode vocal pendant qu'il t'annonce = forfait moral.",
    punchline: "On n'éteint pas le commentateur en plein direct. Ça se fait pas.",
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
        Règlement évolutif. Réclamations à l&apos;arbitre central, micro en main, après la rencontre.
      </footer>
    </main>
  );
}
