# AGENTS.md

## Purpose
- A.T.L.A.S = SPA React/Vite d'aide tactique des secours, intégrations Supabase + proxy OpenAI, cible mobile Capacitor. (source: `README.md`, `package.json`, `src/utils/supabaseClient.ts`, `src/utils/openai.ts`, `capacitor.config.ts`)

## Quick start
- Prérequis: Node.js 18.x (CI), npm. (source: `.github/workflows/ci.yml`, `package.json`)
- Installer: `npm install` (local) / `npm ci` (CI). (source: `package.json`, `.github/workflows/ci.yml`)
- Env: copier `.env.example` vers `.env` ou `.env.local`. (source: `.env.example`)
- Lancer: `npm run dev` (Vite port 5174). (source: `package.json`)

## Environment variables
Required
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (client Supabase). (source: `src/utils/supabaseClient.ts`, `src/env.d.ts`)
- `VITE_OPENAI_PROXY_URL` (proxy IA). (source: `src/utils/openai.ts`, `src/env.d.ts`)

Optional
- `VITE_WEATHER_API_KEY` (météo zonage). (source: `src/pages/OperationalZoning.tsx`, `.env.example`)
- `VITE_MAPTILER_KEY`, `VITE_OFFLINE_TILE_URL`, `VITE_OFFLINE_SOURCE_LAYER` (fallback en code). (source: `src/utils/sitacLayers.ts`, `.env.example`)

Legacy / unused
- `VITE_FIREBASE_*` présent uniquement dans `.env.example`, non référencé dans `src/` actuellement. (source: `.env.example`, `rg -n "import\\.meta\\.env\\.VITE_" src`)
- `VITE_API_BASE_URL` déclaré dans `src/env.d.ts` mais non utilisé dans `src/`. (source: `src/env.d.ts`, `rg -n "VITE_API_BASE_URL" src`)

Supabase local vs cloud
- L'app utilise l'URL définie en env (cloud ou local). Supabase local optionnel via CLI; ports par défaut 54321-54324. (source: `src/utils/supabaseClient.ts`, `supabase/config.toml`)

## Local Supabase
Prérequis
- Supabase CLI + Docker (CLI non intégrée au repo). Exemple: `brew install supabase/tap/supabase` ou `npm i -g supabase`.

Runbook (5 min)
- `npm run supabase:start` (démarre les services locaux + applique migrations).
- `npm run supabase:status` (récupère `API URL`, `anon key`, `service_role key`).
- Mettre à jour `.env`/`.env.local`:
  - `VITE_SUPABASE_URL=http://127.0.0.1:54321`
  - `VITE_SUPABASE_ANON_KEY=<clé anon locale>`
- `npm run dev` pour lancer l'app.

Reset / migrations / seed
- `npm run supabase:reset` (reset DB locale + rejoue migrations + seed si configuré).
- `supabase/config.toml` active `db.seed.enabled = true` avec `./seed.sql` mais le fichier n'existe pas actuellement; ajouter un seed ou désactiver si besoin.

Ports locaux (config.toml)
- API: 54321
- DB: 54322
- Studio: 54323
- Inbucket: 54324

## Commands
- install: `npm install` / `npm ci`. (source: `package.json`, `.github/workflows/ci.yml`)
- dev: `npm run dev` (port 5174). (source: `package.json`)
- lint: `npm run lint` (ESLint). (source: `package.json`, `eslint.config.js`)
- typecheck: `npm run typecheck` (tsc app + node). (source: `package.json`)
- build: `npm run build` (dist). (source: `package.json`, `vite.config.ts`)
- supabase:start: `npm run supabase:start` (CLI Supabase local).
- supabase:stop: `npm run supabase:stop`.
- supabase:reset: `npm run supabase:reset`.
- supabase:status: `npm run supabase:status`.
- supabase:gen-types: `npm run supabase:gen-types` (génère `src/types/supabase.ts`).

## Build notes
- Vite chunking splits heavy libs into `maplibre`, `fabric`, `leaflet`, `html2canvas`, `export`, `ui`, `vendor`. (source: `vite.config.ts`)
- SITAC and dictation routes are lazy-loaded in the router to keep the main bundle smaller. (source: `src/App.tsx`)
- `build.chunkSizeWarningLimit` is set to 1200 kB to reflect cartography bundles (MapLibre). (source: `vite.config.ts`)
- If the bundle sizes change, adjust `manualChunks` or the warning limit in `vite.config.ts`.
- Keep changes limited to Vite config or routing wrappers; do not move SITAC logic.

## SOIEC / SAOIECL notes
- Objectifs (O) peuvent être stockés comme `{ type: 'objective', id, content }` en plus des strings; l'ID est utilisé pour lier les IDM. (source: `src/types/soiec.ts`, `src/utils/soiec.ts`, `src/components/OrdreInitialView.tsx`)
- Idées de manoeuvre (I) supportent `objective_id` + `order_in_objective` pour lier/ordonner les IDM par objectif. (source: `src/types/soiec.ts`, `src/utils/soiec.ts`, `src/utils/interventionHydration.ts`, `src/components/OrdreInitialView.tsx`)
- UI: numérotation automatique des objectifs et IDM, section "Non lié", héritage couleur objectif -> IDM si non défini. (source: `src/components/OrdreInitialView.tsx`)
- Exécution: quick-picks "Moyen" depuis secteurs OCT si présents, sinon liste des engins saisis; quick-picks "Mission" depuis IDM numérotées. (source: `src/components/OrdreInitialView.tsx`, `src/utils/octTreeStore.ts`)

## Repo map
- `src/`: app React (routing, pages, components, contexts, stores, utils). (source: `src/main.tsx`, `src/App.tsx`)
- `src/types/`: typings projet (ex: file-saver.d.ts). (source: `src/types/`)
- `public/`: assets statiques. (source: `public/`)
- `supabase/`: config/migrations locales. (source: `supabase/config.toml`, `supabase/migrations/`)
- `docs/`: audits/checklists. (source: `docs/`)

## CI
- GitHub Actions (push/PR main): `npm ci` → `npm run lint` → `npm run typecheck` (continue-on-error) → `npm run build`. (source: `.github/workflows/ci.yml`)
- Node 18.x. (source: `.github/workflows/ci.yml`)
- TypeScript 5.5.4. (source: `package.json`)
- Build CI injecte `VITE_WEATHER_API_KEY`; autres VITE_* vides (placeholders). (source: `.github/workflows/ci.yml`)
- Typecheck = known issues (non bloquant). (source: `.github/workflows/ci.yml`)

## Release / PR rules
- Contribution: créer une branche `feature/...`, commit, push, ouvrir une PR. (source: `README.md`)

## Troubleshooting
- Écran "Connexion impossible" si env Supabase manquante (message de configuration). (source: `src/contexts/AuthContext.tsx`, `src/components/RequireAuth.tsx`)
- OpenAI: la clé reste côté serveur; client appelle un proxy `VITE_OPENAI_PROXY_URL` avec token Supabase si dispo. (source: `src/utils/openai.ts`)
- Supabase local: ports 54321-54324. (source: `supabase/config.toml`)
