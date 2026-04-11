# ATLAS — Claude Code Instructions

## Contexte projet
Lire AGENTS.md avant toute intervention. Il contient la carte complète du projet (stack, env vars, architecture, runbook, SOIEC/SAOIECL).

## Règles absolues — ne jamais déroger

- **Ne jamais modifier** `supabase/migrations/` sans confirmation explicite.
- **Ne jamais toucher** la logique SITAC ni déplacer ses composants (voir Build notes dans AGENTS.md).
- **Lire le fichier concerné avant toute modification.** Jamais d'édition à l'aveugle.
- **Ne pas créer de nouveaux fichiers** sauf si strictement nécessaire et demandé.
- **Correction d'un bug = périmètre du bug uniquement.** Ne pas refactoriser le code adjacent.

## Stack de référence
React 18 / Vite / TypeScript strict — Supabase — OpenAI via proxy (`VITE_OPENAI_PROXY_URL`) — Capacitor (cible mobile).
Node 18.x. Voir AGENTS.md §Environment variables avant tout accès aux variables d'environnement.

## Qualité du code

- Respecter les conventions TypeScript déjà en place dans `src/`. Ne pas imposer de nouveaux patterns.
- Typage strict. Pas de `any` sans justification explicite.
- Pas d'abstractions pour usage unique. Pas de future-proofing non demandé.
- Commentaires inline uniquement si la logique est non évidente.

## Comportement

- Répondre directement. La réponse est à la ligne 1.
- Pas de reformulation de la demande. Pas de "Bien sûr !", "Absolument !".
- Pas de suggestions non sollicitées hors périmètre de la demande.
- Si incertain sur un fichier ou une API : lire d'abord, répondre ensuite. Jamais de spéculation.
- Si la réponse est inconnue : dire "Je ne sais pas." Jamais d'invention de chemins ou de signatures.

## Gestion du contexte

- Ne jamais relire un fichier déjà lu dans la session sauf si modifié depuis.
- À 70% de contexte : utiliser `/compact`. À 90%+ : `/clear` obligatoire avant nouvelle tâche.

## Override
Les instructions explicites de l'utilisateur priment toujours sur ce fichier.
