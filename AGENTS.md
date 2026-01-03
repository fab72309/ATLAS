# AGENTS.md

## Purpose
Ce depot contient l'app A.T.L.A.S, une SPA React/Vite pour l'aide tactique des secours, avec integration Supabase et proxy OpenAI, et une cible mobile via Capacitor. (source: `README.md`, `package.json`, `vite.config.ts`, `src/utils/supabaseClient.ts`, `src/utils/openai.ts`, `capacitor.config.ts`)

## Quick start
- Pre-requis: Node.js 18+; comptes Supabase/OpenAI/GitHub selon besoin. (source: `README.md`)
- Utiliser npm (lockfile present). (source: `package-lock.json`)
- Installer les dependances: `npm install`. (source: `README.md`)
- Copier `.env.example` vers `.env`. (source: `.env.example`)
- VITE_* requis (pas de fallback): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_OPENAI_PROXY_URL`. (source: `src/utils/supabaseClient.ts`, `src/utils/openai.ts`)
- VITE_* optionnel (fonctionnalite meteo, pas de fallback): `VITE_WEATHER_API_KEY`. (source: `src/pages/OperationalZoning.tsx`, `.env.example`)
- VITE_* avec fallback en code: `VITE_MAPTILER_KEY`, `VITE_OFFLINE_TILE_URL`, `VITE_OFFLINE_SOURCE_LAYER`. (source: `src/utils/sitacLayers.ts`)
- Lancer le dev server: `npm run dev` (Vite sur le port 5174). (source: `package.json`)

## Standard commands
| Task | Command | Notes |
| --- | --- | --- |
| install | `npm install` / `npm ci` | `npm install` en local, `npm ci` en CI. (source: `README.md`, `.github/workflows/ci.yml`) |
| dev | `npm run dev` | Vite sur le port 5174. (source: `package.json`) |
| lint | `npm run lint` | ESLint configure dans `eslint.config.js`. (source: `package.json`, `eslint.config.js`) |
| test | TODO | Aucun script de test defini; CI ne lance pas de tests. (source: `package.json`, `.github/workflows/ci.yml`) |
| build | `npm run build` | Sortie dans `dist`. (source: `package.json`, `vite.config.ts`) |
| typecheck | `npm run typecheck` | Non-bloquant en CI (continue-on-error); echec actuel a corriger (TODO). Commande: `tsc -p tsconfig.app.json --noEmit && tsc -p tsconfig.node.json --noEmit`. (source: `package.json`, `.github/workflows/ci.yml`, `tsconfig.app.json`, `tsconfig.node.json`) |
| format | TODO | Aucun script defini. (source: `package.json`) |
| e2e | TODO | Aucun script defini. (source: `package.json`) |
| deploy | TODO | Aucun script/config de deploiement dans le repo. (source: `package.json`, `.github/workflows/ci.yml`) |

## Repository map
- `src/`: point d'entree et routing. (source: `src/main.tsx`, `src/App.tsx`)
- `src/pages/`: ecrans routes. (source: `src/App.tsx`)
- `src/components/`: layout et error boundary partages. (source: `src/App.tsx`)
- `src/contexts/`: providers Auth/Theme. (source: `src/main.tsx`, `src/contexts/AuthContext.tsx`, `src/contexts/ThemeContext.tsx`)
- `src/stores/`: stores Zustand avec persistance locale. (source: `docs/state_audit.md`)
- `src/utils/`: integrations Supabase/OpenAI/stockage. (source: `src/utils/supabaseClient.ts`, `src/utils/openai.ts`, `src/utils/userStorage.ts`)
- `public/`: assets statiques et icones. (source: `public/Logo_1.png`, `public/icons/group.png`)
- `supabase/`: config Supabase locale et migrations. (source: `supabase/config.toml`, `supabase/migrations/20251227214329_atlas_core.sql`)
- `docs/`: checklists et audits. (source: `docs/auth_isolation_tests.md`, `docs/state_audit.md`)
- `dist/`: sortie de build. (source: `vite.config.ts`)

## Architecture overview
- SPA React/Vite; point d'entree `index.html` -> `src/main.tsx`; routing via `HashRouter`. (source: `index.html`, `src/main.tsx`, `src/App.tsx`, `vite.config.ts`)
- Auth et donnees via Supabase JS; session geree dans `AuthProvider`. (source: `src/utils/supabaseClient.ts`, `src/contexts/AuthContext.tsx`)
- IA via proxy `VITE_OPENAI_PROXY_URL`, avec token Supabase en header. (source: `src/utils/openai.ts`)
- Etat client: stores Zustand + localStorage scope utilisateur. (source: `docs/state_audit.md`, `src/utils/userStorage.ts`)
- UI via Tailwind CSS + PostCSS. (source: `tailwind.config.js`, `postcss.config.js`)
- Cible mobile via Capacitor; `webDir` = `dist`, live reload conditionnel sur `CAP_LIVE_RELOAD` et `http://localhost:5174`. (source: `capacitor.config.ts`)

## Coding standards
- TypeScript strict, noEmit, moduleResolution bundler. (source: `tsconfig.app.json`, `tsconfig.node.json`)
- ESLint: configs recommandees + react-hooks + react-refresh; `dist` ignore. (source: `eslint.config.js`)
- Tailwind en mode dark par classe + plugin typography. (source: `tailwind.config.js`)
- Aucun script format defini; suivre le style existant et ESLint. (source: `package.json`, `eslint.config.js`)

## Testing strategy
- Checklist manuelle d'isolement auth (inclut `npx supabase db reset` et `npm run dev`). (source: `docs/auth_isolation_tests.md`)
- Audit et cles de stockage documentes. (source: `docs/state_audit.md`)
- Tests automatises non definis; aligner avec la CI. (source: `package.json`, `.github/workflows/ci.yml`)

## CI/CD & environments
- GitHub Actions sur push/PR main; Node 18; `npm ci` -> `npm run lint` -> `npm run typecheck` (continue-on-error) -> `npm run build`. (source: `.github/workflows/ci.yml`)
- VITE_* requis (pas de fallback): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_OPENAI_PROXY_URL`. (source: `src/utils/supabaseClient.ts`, `src/utils/openai.ts`)
- VITE_* optionnel (fonctionnalite meteo, pas de fallback): `VITE_WEATHER_API_KEY`. (source: `src/pages/OperationalZoning.tsx`, `.env.example`)
- VITE_* avec fallback en code: `VITE_MAPTILER_KEY`, `VITE_OFFLINE_TILE_URL`, `VITE_OFFLINE_SOURCE_LAYER`. (source: `src/utils/sitacLayers.ts`)
- Build CI injecte `VITE_WEATHER_API_KEY` via secrets; `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_OPENAI_PROXY_URL` sont vides (TODO secrets). (source: `.github/workflows/ci.yml`)
- Live reload Capacitor via `CAP_LIVE_RELOAD`. (source: `capacitor.config.ts`)

## Database & migrations
- Ports Supabase locaux: API 54321, DB 54322, Studio 54323, Inbucket 54324. (source: `supabase/config.toml`)
- Migrations dans `supabase/migrations/*.sql`. (source: `supabase/migrations/20251227214329_atlas_core.sql`)
- Migrations + seed actives; seed configuree `./seed.sql`. (source: `supabase/config.toml`)
- Reset manuel: `npx supabase db reset`. (source: `docs/auth_isolation_tests.md`)

## Security & secrets
- Ne jamais partager de cles API/identifiants. (source: `SECURITY.md`)
- OpenAI: cle cote serveur; client via proxy `VITE_OPENAI_PROXY_URL` avec token Supabase. (source: `README.md`, `src/utils/openai.ts`)
- Supabase Auth + RLS protegent les donnees. (source: `README.md`)
- Stockage isole par utilisateur (`atlas:v1:<userId>:...`) et purge sur changement d'utilisateur. (source: `docs/state_audit.md`, `src/utils/userStorage.ts`)
- CI utilise `VITE_WEATHER_API_KEY` via GitHub Secrets; autres VITE_* requis sont absents (TODO). (source: `.github/workflows/ci.yml`)

## Change management rules
- Suivre le flux de contribution: branche `feature/...`, commit `feat: ...`, PR. (source: `README.md`)
- Definition du done: `npm run lint` + `npm run typecheck` + `npm run build` et checklist d'isolement auth si auth/stockage touche. (source: `package.json`, `.github/workflows/ci.yml`, `docs/auth_isolation_tests.md`)
- Pour tout changement de schema, mettre a jour les migrations Supabase dans `supabase/migrations`. (source: `supabase/migrations/20251227214329_atlas_core.sql`)

## When unsure
- Relire `README.md` pour prerequis, setup, securite. (source: `README.md`)
- Consulter `docs/auth_isolation_tests.md` et `docs/state_audit.md` pour les comportements attendus. (source: `docs/auth_isolation_tests.md`, `docs/state_audit.md`)
- Verifier scripts/versions dans `package.json` et `package-lock.json`. (source: `package.json`, `package-lock.json`)
- Verifier config Supabase dans `supabase/config.toml` et migrations dans `supabase/migrations`. (source: `supabase/config.toml`, `supabase/migrations/20251227214329_atlas_core.sql`)
- Tracer les variables d'env dans `src/utils/supabaseClient.ts` et `src/utils/openai.ts` avant toute modification `.env`. (source: `src/utils/supabaseClient.ts`, `src/utils/openai.ts`)

## Uncertainties & TODO
- Definir une strategie de tests automatise (aucun script test, CI ne lance pas de tests). (source: `package.json`, `.github/workflows/ci.yml`)
- Corriger les erreurs TypeScript pour rendre `npm run typecheck` bloquant. (source: `.github/workflows/ci.yml`)
- Fournir des secrets CI pour `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_OPENAI_PROXY_URL` (valeurs vides en CI). (source: `.github/workflows/ci.yml`)
- VITE_FIREBASE_* present uniquement dans `.env.example` (aucun usage import.meta.env dans `src/utils/supabaseClient.ts`, `src/utils/openai.ts`, `src/pages/OperationalZoning.tsx`, `src/utils/sitacLayers.ts`); traiter comme legacy jusqu'a confirmation. (source: `.env.example`, `src/utils/supabaseClient.ts`, `src/utils/openai.ts`, `src/pages/OperationalZoning.tsx`, `src/utils/sitacLayers.ts`)
- Creer `supabase/seed.sql` ou ajuster la configuration de seed. (source: `supabase/config.toml`)
- Documenter le deploiement (README ne couvre que le build). (source: `README.md`)
