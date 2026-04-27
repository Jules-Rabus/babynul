# Babynul !

Application de gestion des parties de baby-foot entre collègues.

**Stack** : Next.js 15 (App Router) + Prisma + Postgres (hébergé sur Supabase) + Zod + Tailwind/shadcn + React Query + MSW (mode mock).

## Architecture (sécurité)

Tout ce qui touche à la base de données passe côté serveur Next.js — **aucun accès Supabase depuis le navigateur**.

```
Browser
  ├─ useQuery → fetch('/api/players')                   (GET)
  └─ useMutation → Server Action (ex: recordMatch)      (POST /)
                              │
                              ▼
Next.js Server (Node runtime, Fluid Compute)
  ├─ Zod.parse(input) en première ligne
  ├─ assertAdmin() si action admin
  ├─ Prisma pour CRUD + $queryRaw pour les RPC PL/pgSQL
  │    (record_match, undo_last_match, place_wager, etc.)
  └─ isAdminUnlocked() lit le cookie httpOnly serveur
                              │
                              ▼
Postgres sur Supabase
  (accessible uniquement via POSTGRES_PRISMA_URL server-only)
```

Les policies RLS d'écriture publiques sont **droppées** (migration 0012). Même si la publishable key Supabase fuite, un attaquant ne peut plus écrire dans la BDD.

## Fonctionnalités

- **Classement** individuel et équipes (Elo pondéré par la marge de buts, K=32), médailles 🥇🥈🥉 indépendantes du tri
- **Saisie de matchs** 1v1 ou 2v2 avec **stepper ±** (équipes créées automatiquement)
- **Score cible configurable** (3 / 5 / 7 / 10 points) par partie et par tournoi, validé côté serveur
- **Matchmaking équilibré** : priorité aux joueurs qui ont le moins joué dans la partie du jour courant, appariement dynamique parmi les 3 combinaisons possibles avec anti-répétition des paires
- **Parties du jour persistées** (`play_sessions`) : liste vivante de présents, compteur par joueur, clôture propre, score cible par partie
- **Départ en cours de partie** : les matchs ouverts du joueur sont annulés, mises remboursées, possibilité de régénérer la suite
- **Saisie directe depuis le matchmaking** : bouton « Saisir le score » sur chaque match, dialog pré-rempli avec stepper
- **Suppression de match** : bouton 🗑️ sur chaque match ouvert (remboursement auto)
- **Paris inline avec cotes Elo** : encart dépliable sur chaque match du matchmaking, cote + mise + gain potentiel
- **Revanches & belles** : détection auto des face-à-face récents, ouverture de paris en un clic
- **Tournoi à élimination directe persisté** (`tournaments` / `tournament_matches`) : bracket 1v1 **ou 2v2**, score cible configurable, rotation des paires (`buildBalancedPairs`), matchs joués un par un, ELO + paris intégrés, historique complet
- **Historique du jour** dans le matchmaking : tournois + parties clôturés du jour, détail cliquable avec bracket figé
- **Surnoms** éditables par joueur, utilisés dans les annonces vocales
- **Voice mode IA** (après saisie de score) :
  - Phrase en style commentateur sportif générée par LLM (Gemini ou OpenAI)
  - Synthèse vocale via Gemini 3.1 Flash TTS (fallback OpenAI `gpt-4o-mini-tts`)
  - **Mode GOAT** 🐐 : 3+ victoires d'affilée → intro épique
  - **Mode Roast** 💀 : 3+ défaites d'affilée → chambrage style interview d'après-match
  - Prompt **éditable depuis l'UI admin** (onglet « Réglages »), persisté en BDD
- **Pages publiques** : `/demo` (showcase sans BDD), `/reglement` (règles FFFT + règles maison style plateau sportif)
- **Historique** + courbe d'évolution de l'Elo par joueur
- **Undo** : annuler le dernier match (reverse les deltas Elo + rembourse les paris)
- **Mode admin** : code serveur qui débloque saisie, ouverture de paris, gestion des joueurs, édition du prompt voice
- Dark / Light mode, **mobile-first**, interface en français

## Prérequis

- Node.js 20+
- Un projet Supabase (plan gratuit suffit)
- Facultatif : clé Gemini (Google AI Studio) et/ou OpenAI pour le voice mode

## 1 — Configuration Supabase

1. Créer un projet sur [database.new](https://database.new).
2. Dans le dashboard Supabase → **SQL Editor**, exécuter dans l'ordre les fichiers de `supabase/migrations/` :
   - `0001_init.sql` — tables core (`players`, `teams`, `matches`) + index
   - `0002_rls.sql` — RLS lecture publique
   - `0003_triggers.sql` — triggers auxiliaires
   - `0004_rpc.sql` — `record_match`, `elo_delta`, `delete_player_cascade`
   - `0005_undo.sql` — `undo_last_match`
   - `0006_bets.sql` — sondages (déprécié, droppé par 0008)
   - `0007_wagers.sql` — paris avec cotes Elo (version bettor_key)
   - `0008_unify_bettor_player.sql` — unification parieur = joueur
   - `0009_player_nickname.sql` — surnom optionnel
   - `0010_play_sessions.sql` — tournois du jour persistés + RPC session
   - `0011_voice_prompts.sql` — table `voice_prompt_config` (prompt LLM éditable)
   - `0012_lockdown_rls.sql` — drop des policies d'écriture publiques (à appliquer **en dernier**, après avoir vérifié que Prisma tape bien)
   - `0013_tournaments.sql` — `tournaments`, `tournament_participants`, `tournament_matches` + RPC `create_tournament`, `record_tournament_match`, `end_tournament`, `tournament_cascade_byes`
   - `0014_elo_margin.sql` — `elo_delta_weighted` + `record_match_v3` (ELO pondéré par la marge de buts) ; `play_sessions.target_score` ; `start_play_session_v2`
3. Récupérer la connection string Prisma : **Settings → Database → Connection string → Prisma** (ou via l'intégration Vercel ↔ Supabase qui la provisionne automatiquement).

## 2 — Variables d'environnement

Copier `.env.local.example` vers `.env.local` et renseigner :

```bash
# Postgres (server-only, Prisma)
# Fournis automatiquement par l'intégration Vercel ↔ Supabase.
POSTGRES_PRISMA_URL=postgres://...?pgbouncer=true&connection_limit=1
POSTGRES_URL_NON_POOLING=postgres://...  # direct, pour migrations / introspection

# Code admin (débloque saisie + gestion + voice prompt editor)
ADMIN_CODE=un-code-secret

# Voice mode — au moins une des deux clés (optionnel)
VOICE_PROVIDER=gemini
GOOGLE_GENERATIVE_AI_API_KEY=
OPENAI_API_KEY=
```

Sans clé IA, le voice mode reste désactivé mais tout le reste de l'app fonctionne.

## 3 — Lancement local

```bash
npm install
npx prisma generate     # génère le client typé à partir de prisma/schema.prisma
npm run dev             # mode normal (tape sur le Postgres via Prisma)
npm run start:mock      # mode mock (MSW intercepte /api/*, 12 joueurs fictifs)
```

Ouvrir http://localhost:3000.

En **mode mock** (`NEXT_PUBLIC_USE_MSW=1`), les route handlers `/api/*` sont interceptés côté navigateur par [MSW](https://mswjs.io) : aucun appel réel à Postgres. Pratique pour tester l'UI et le voice mode IA sans BDD configurée.

## 4 — Tests

```bash
npm test                # vitest run
npm run test:watch      # mode watch
```

43 tests couvrent `matchmaking` (équité session, variété, anti-répétition), `elo`, `player-form` (détection GOAT/Roast), `player-display`, `build-announce-prompt` (substitution des placeholders).

## 5 — Déploiement Vercel

1. Pousser le repo sur GitHub.
2. Sur [vercel.com/new](https://vercel.com/new), importer le repo.
3. Activer l'intégration **Supabase** dans la Marketplace Vercel → elle provisionne automatiquement `POSTGRES_PRISMA_URL` et `POSTGRES_URL_NON_POOLING`.
4. Ajouter manuellement : `ADMIN_CODE` (obligatoire pour les mutations admin), et optionnellement `GOOGLE_GENERATIVE_AI_API_KEY` / `OPENAI_API_KEY` / `VOICE_PROVIDER`.
5. Déployer.

Le build Prisma se fait automatiquement via le hook `postinstall` (`prisma generate`).

## Flux matchmaking

1. **Démarrer un tournoi** (bouton admin « Démarrer un tournoi »).
2. **Cocher les présents** parmi les joueurs → persisté dans `session_players`.
3. **Générer les matchs** → crée N `proposed_matches` liés à la session, équilibrés par Elo, priorité aux joueurs qui ont le moins joué dans le tournoi.
4. Pour chaque match :
   - **« Saisir le score »** → dialog pré-rempli → enregistre le match + résout le `proposed_match` + paye les paris + trigger voice mode.
   - 🗑️ **« Supprimer »** → annule le match et rembourse les mises.
5. **Régénérer la suite** : annule tous les matchs ouverts et relance la génération avec le compteur à jour.
6. **Joueur qui part** : décocher sa présence → confirmation → ses matchs ouverts sont annulés, mises remboursées.
7. **Clôturer le tournoi** quand c'est fini.

La saisie/suppression demandent le **mode admin** (bouton 🔒 en haut à droite). Si non débloqué, un toast invite à entrer le code.

## Structure

```
prisma/
└── schema.prisma              Schéma Prisma (reflète les migrations SQL)

src/
├── app/
│   ├── actions/               Server Actions — toutes les mutations
│   │   ├── players.ts         addPlayer, updatePlayerNickname, deletePlayerCascade
│   │   ├── matches.ts         recordMatch, undoLastMatch
│   │   ├── sessions.ts        startSession, endSession, setSessionPresence, …
│   │   ├── proposed-matches.ts create, cancel, resolve
│   │   ├── wagers.ts          placeWager
│   │   └── voice-prompt.ts    updateVoicePromptConfig
│   ├── api/                   Route handlers — toutes les lectures
│   │   ├── players/           GET /api/players
│   │   ├── teams/             GET /api/teams (avec jointure players)
│   │   ├── matches/           GET /api/matches?scope=recent|player|session
│   │   ├── sessions/active/   GET /api/sessions/active
│   │   ├── proposed-matches/  GET /api/proposed-matches?sessionId=X
│   │   ├── wagers/            GET /api/wagers?proposedMatchId=X
│   │   └── voice/
│   │       ├── config/        GET /api/voice/config
│   │       ├── announce/      POST /api/voice/announce → audio TTS
│   │       └── preview/       POST /api/voice/preview  → texte dry-run
│   ├── demo/                  Page publique (mock data)
│   ├── reglement/             Règles FFFT + règles maison style plateau sportif
│   └── page.tsx               App principale
├── components/                UI (matchmaking, matches, ranking, wagers, …)
├── hooks/                     use-current-player, use-player-forms
├── lib/
│   ├── prisma.ts              Singleton PrismaClient
│   ├── admin-guard.ts         assertAdmin() pour les Server Actions
│   ├── admin-code.ts          Gestion du cookie httpOnly admin
│   ├── api-client.ts          fetch helper pour les hooks useQuery
│   ├── schemas/               Schémas Zod partagés client/serveur
│   ├── db/
│   │   ├── types.ts           Shapes snake_case exposées par /api/*
│   │   └── map.ts             Adaptateurs Prisma (camelCase) → Row (snake_case)
│   ├── queries/               Hooks React Query (fetch + Server Actions)
│   ├── voice/                 Voice mode (providers TTS, prompt builder, player-form)
│   ├── demo/                  Fixtures (12 joueurs, session, matchs GOAT/Roast)
│   ├── elo.ts                 Formule Elo + cotes
│   ├── matchmaking.ts         Génération de matchs variés
│   ├── player-display.ts      displayName / announceName
│   ├── rivalries.ts           Détection revanches/belles
│   └── tournament.ts          Bracket à élimination directe
└── test/
    └── msw/
        ├── handlers/api-browser.ts   Intercepte /api/* (mode mock navigateur)
        ├── handlers/supabase.ts      Handlers Node pour Vitest (vides)
        └── server.ts

supabase/migrations/           Migrations SQL 0001 → 0012
```

## Scripts

```bash
npm run dev         # Dev (Prisma → Postgres direct)
npm run start:mock  # Dev avec MSW (pas de BDD)
npm run build       # Build de production
npm start           # Serveur de production
npm run lint        # ESLint
npm test            # Vitest run
npm run test:watch  # Vitest watch
```
