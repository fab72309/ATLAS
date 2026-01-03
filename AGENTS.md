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

## Commands
- install: `npm install` / `npm ci`. (source: `package.json`, `.github/workflows/ci.yml`)
- dev: `npm run dev` (port 5174). (source: `package.json`)
- lint: `npm run lint` (ESLint). (source: `package.json`, `eslint.config.js`)
- typecheck: `npm run typecheck` (tsc app + node). (source: `package.json`)
- build: `npm run build` (dist). (source: `package.json`, `vite.config.ts`)

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
