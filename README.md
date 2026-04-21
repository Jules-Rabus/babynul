# Babynul !

Application de gestion des parties de Baby-Foot entre collègues.
Stack : **Next.js 15** (App Router) + **Supabase** (Postgres + RLS) + **Tailwind/shadcn** + **React Query** + **MSW** (mode mock).

## Fonctionnalités

- **Classement** individuel et équipes (Elo, K=32), médailles 🥇🥈🥉 indépendantes du tri
- **Saisie de matchs** 1v1 ou 2v2 (équipes créées automatiquement)
- **Matchmaking équilibré** : priorité aux joueurs qui ont le moins joué **dans le tournoi du jour courante** (pas dans l'historique), appariement fort+faible
- **Tournois du jour persistés** (`play_sessions`) : liste vivante de présents, compteur par joueur, clôture propre
- **Départ en cours de tournoi** : les matchs ouverts du joueur sont annulés, mises remboursées, possibilité de régénérer la suite
- **Saisie directe depuis le matchmaking** : bouton « Saisir le score » sur chaque match généré, dialog pré-rempli
- **Suppression de match** : bouton 🗑️ sur chaque match ouvert (remboursement auto)
- **Paris avec cotes Elo** : chaque joueur parie des points fictifs sur les matchs proposés
- **Revanches & belles** : détection auto des face-à-face récents, ouverture de paris en un clic
- **Tournoi** à élimination directe avec bracket aléatoire
- **Surnoms** éditables par joueur, utilisés dans les annonces vocales
- **Voice mode IA** (après saisie de score) :
  - Phrase drôle générée par LLM (Gemini ou OpenAI) en style commentateur sportif
  - Synthèse vocale via Gemini 3.1 Flash TTS (fallback OpenAI `gpt-4o-mini-tts`)
  - **Mode GOAT** 🏆 : 3+ victoires d'affilée → intro épique, couronne le joueur
  - **Mode Roast** 💀 : 3+ défaites d'affilée → chambrage gentil
  - Détection sur scope session quand un tournoi est active
- **Pages publiques** : `/demo` (showcase sans BDD), `/reglement` (règles FFFT + règles maison)
- **Historique des parties** + courbe d'évolution de l'Elo par joueur
- **Undo** : annuler le dernier match (reverse les deltas Elo + rembourse les paris)
- **Mode admin** : code serveur qui débloque saisie, ouverture de paris, gestion des joueurs
- Dark / Light mode, **mobile-first**, interface en français

## Prérequis

- Node.js 20+
- Un projet Supabase (plan gratuit suffit)
- Facultatif : clé **Gemini** (Google AI Studio) et/ou **OpenAI** pour le voice mode

## 1 — Configuration Supabase

1. Créer un projet sur [database.new](https://database.new).
2. Dans le dashboard Supabase → **SQL Editor**, exécuter dans l'ordre les fichiers de `supabase/migrations/` :
   - `0001_init.sql` — tables core (`players`, `teams`, `matches`) + index
   - `0002_rls.sql` — RLS (lecture publique, écritures passent par les RPC)
   - `0003_triggers.sql` — triggers auxiliaires
   - `0004_rpc.sql` — `record_match`, `elo_delta`, `delete_player_cascade`
   - `0005_undo.sql` — `undo_last_match`
   - `0006_bets.sql` — sondages (déprécié, droppé par 0008)
   - `0007_wagers.sql` — paris avec cotes Elo (version bettor_key)
   - `0008_unify_bettor_player.sql` — unification parieur = joueur, ajoute `wager_*` sur `players`
   - `0009_player_nickname.sql` — surnom optionnel
   - `0010_play_sessions.sql` — tournois du jour persistés + RPC session
3. **Settings → API → Publishable key** : copier la valeur `sb_publishable_...` (ou l'ancienne `anon key`).

## 2 — Variables d'environnement

Copier `.env.local.example` vers `.env.local` et renseigner :

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx

# Code admin (débloque saisie + gestion)
ADMIN_CODE=un-code-secret

# Voice mode — au moins une des deux clés
VOICE_PROVIDER=gemini
GOOGLE_GENERATIVE_AI_API_KEY=AIza...
OPENAI_API_KEY=sk-...
```

Le voice mode n'est pas bloquant : sans clé IA, l'app fonctionne normalement, seul le bouton 🔊 reste inerte.

## 3 — Lancement local

```bash
npm install
npm run dev             # mode normal (tape sur Supabase)
npm run start:mock      # mode mock (MSW intercepte Supabase, 12 joueurs fictifs)
```

Ouvrir http://localhost:3000.

En **mode mock** (`NEXT_PUBLIC_USE_MSW=1`), aucun appel réseau ne sort : tout est intercepté côté navigateur par [MSW](https://mswjs.io). Pratique pour tester le voice mode IA sans toucher à la prod.

## 4 — Tests

```bash
npm test                # vitest run (unitaires + RTL + MSW node)
npm run test:watch      # mode watch
```

39 tests couvrent `matchmaking`, `elo`, `player-form` (GOAT/Roast), `player-display`, `build-announce-prompt`.

## 5 — Déploiement Vercel

1. Pousser le repo sur GitHub.
2. Sur [vercel.com/new](https://vercel.com/new), importer le repo.
3. Ajouter les variables d'env : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `ADMIN_CODE`, et au moins une clé IA (`GOOGLE_GENERATIVE_AI_API_KEY` ou `OPENAI_API_KEY`).
4. Déployer.

## Flux matchmaking (important)

1. **Démarrer un tournoi** (bouton admin « Démarrer un tournoi »).
2. **Cocher les présents** parmi les joueurs → persisté dans `session_players`.
3. **Générer les matchs** → crée N `proposed_matches` liés à la session, équilibrés par Elo, priorité aux joueurs qui ont le moins joué dans le tournoi du jour.
4. Pour chaque match :
   - Bouton **« Saisir le score »** → dialog pré-rempli → enregistre le match + résout le `proposed_match` + paye les paris + trigger voice mode.
   - Bouton 🗑️ **« Supprimer »** → annule le match et rembourse les mises.
5. **Régénérer la suite** : annule tous les matchs ouverts et relance la génération avec le compteur à jour.
6. **Joueur qui part** : décocher sa présence → confirmation → ses matchs ouverts sont annulés, mises remboursées. Générer à nouveau pour la suite.
7. **Clôturer le tournoi** quand c'est fini.

La saisie/suppression demandent le **mode admin** (bouton 🔒 en haut à droite). Si non débloqué, un toast invite à entrer le code.

## Structure

```
src/
├── app/
│   ├── api/voice/announce/  Route POST — LLM prompt → Gemini TTS → audio
│   ├── demo/                Page publique (mock data)
│   ├── reglement/           Règles FFFT + règles maison
│   └── page.tsx             App principale
├── components/
│   ├── matchmaking/         Panel, session-controls, dialog de saisie
│   ├── matches/             Saisie 1v1/2v2, undo
│   ├── players-admin/       Table + ajout + édition surnom
│   ├── ranking/             Classements + modal stats par joueur
│   ├── tournament/          Bracket à élimination directe
│   ├── wagers/              Paris + leaderboard tipsters
│   ├── footer.tsx           Footer global
│   └── providers.tsx        React Query + thème + bootstrap MSW
├── hooks/                   use-current-player, use-player-forms
├── lib/
│   ├── demo/                Fixtures (12 joueurs, session, matchs)
│   ├── queries/             Hooks React Query (players, matches, teams, wagers, play-sessions)
│   ├── supabase/            Clients browser + types
│   ├── voice/
│   │   ├── provider.ts              Interface TTS abstraite
│   │   ├── providers/gemini.ts      Gemini 3.1 Flash TTS
│   │   ├── providers/openai.ts      OpenAI gpt-4o-mini-tts
│   │   ├── registry.ts              Sélection + fallback auto
│   │   ├── player-form.ts           Détection GOAT/Roast
│   │   ├── build-announce-prompt.ts Prompt LLM avec injection des modes
│   │   └── use-announce-next-match.ts Hook client + toggle persistant
│   ├── elo.ts               Formule Elo + presets + cotes
│   ├── matchmaking.ts       Génération de matchs équilibrés
│   ├── player-display.ts    displayName / announceName (surnom prioritaire)
│   ├── rivalries.ts         Détection revanches/belles
│   └── tournament.ts        Bracket à élimination directe
└── test/
    ├── msw/
    │   ├── handlers/supabase-browser.ts  Intercepte tous les endpoints Supabase
    │   ├── handlers/supabase.ts          Handlers Node pour Vitest
    │   └── server.ts
    └── setup.ts

supabase/migrations/         Migrations SQL numérotées 0001 → 0010
```

## Scripts

```bash
npm run dev         # Dev normal (Supabase prod)
npm run start:mock  # Dev avec MSW (pas de BDD)
npm run build       # Build de production
npm start           # Serveur de production
npm run lint        # ESLint
npm test            # Vitest run
npm run test:watch  # Vitest watch
```
