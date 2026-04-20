# Babynul !

Application de gestion des parties de Baby-Foot entre collègues.
Stack : **Next.js 15** (App Router) + **Supabase** (Postgres + Auth Google SSO) + **Tailwind/shadcn** + **React Query**.

## Fonctionnalités

- Classement **individuel** et **équipes** (Elo, K=32)
- Saisie de matchs **1v1** ou **2v2** (équipes créées automatiquement)
- **Matchmaking** équilibré : génère une journée de matchs en appariant fort+faible
- Historique des parties + **courbe d'évolution de l'Elo** par joueur
- Admin joueurs : ajout avec presets Elo (Faible 800 / Moyen 1000 / Fort 1200), suppression en cascade
- **Recherche** + **tris croisés** partout, médailles 🥇🥈🥉 indépendantes du tri courant
- Dark / Light mode, interface en français

## Prérequis

- Node.js 20+
- Un projet Supabase (plan gratuit suffit)
- Un client OAuth Google

## 1 — Configuration Supabase

1. Créer un projet sur [database.new](https://database.new) (région `eu-west-3` / Paris recommandée).
2. Dans le dashboard Supabase → **SQL Editor**, exécuter dans l'ordre les fichiers de `supabase/migrations/` :
   - `0001_init.sql` (tables + index)
   - `0002_rls.sql` (RLS : lecture publique, écriture authentifiée)
   - `0003_triggers.sql` (auto-création d'un profil joueur à la 1re connexion)
   - `0004_rpc.sql` (RPC transactionnels : record_match, delete_player_cascade, Elo)
3. **Authentication → Providers → Google** : activer. Coller le Client ID et Client Secret (voir étape 2).
4. **Settings → API → Publishable key** : copier la valeur `sb_publishable_...` (ou l'ancienne `anon key` si votre projet n'a pas encore été migré).

## 2 — OAuth Google

1. Dans [Google Cloud Console](https://console.cloud.google.com/apis/credentials), créer un **OAuth 2.0 Client ID** de type _Web application_.
2. **Authorized redirect URIs** : y ajouter l'URL de callback affichée dans Supabase → Auth → Providers → Google (format `https://<project-ref>.supabase.co/auth/v1/callback`).
3. Copier le Client ID + Secret dans Supabase (étape 1.3).

## 3 — Variables d'environnement

Copier `.env.local.example` vers `.env.local` et renseigner :

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

## 4 — Lancement local

```bash
npm install
npm run dev
```

Ouvrir http://localhost:3000 et cliquer sur « Se connecter avec Google ».

## 5 — Déploiement Vercel

1. Pousser le repo sur GitHub.
2. Sur [vercel.com/new](https://vercel.com/new), importer le repo.
3. Ajouter les 2 variables d'env (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`).
4. Après le premier déploiement, ajouter l'URL prod (ex. `https://babynul.vercel.app/auth/callback`) dans :
   - Google Cloud Console (Authorized redirect URIs)
   - Supabase Auth → URL Configuration → Site URL & Redirect URLs

## Structure

```
src/
├── app/                 Routes Next.js (login, auth/callback, auth/signout, page principale)
├── components/          Composants UI (ranking, matches, matchmaking, players-admin, shadcn/ui)
├── hooks/               use-session
├── lib/
│   ├── elo.ts           Formule Elo + presets
│   ├── matchmaking.ts   Algorithme de matchmaking équilibré
│   ├── queries/         Hooks React Query
│   └── supabase/        Clients browser/server/middleware + types
└── middleware.ts        Refresh session SSR

supabase/migrations/     Migrations SQL (schema, RLS, triggers, RPC)
```

## Scripts

```bash
npm run dev      # serveur de développement
npm run build    # build de production
npm run lint     # ESLint
npm start        # serveur de production (après build)
```
