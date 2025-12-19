import OpenAI from 'openai';
import cors from 'cors';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { CommandType, PromptMode } from './prompts';
import { DeveloperPrompts, OutputSchemas, buildUserPrompt } from './prompts';

// Initialisation Admin (Firebase Functions)
try { initializeApp(); } catch {}

const corsMw = cors({ origin: true });

// Secret (Firebase Functions / Secret Manager)
const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY');

// Utilitaire: vérifier (facultatif) le token Firebase du client
async function verifyIdTokenMaybe(authHeader?: string) {
  const allowUnauth = process.env.ALLOW_UNAUTHENTICATED === 'true';
  if (!authHeader) {
    if (allowUnauth) return null;
    throw new Error('Missing Authorization header');
  }
  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    if (allowUnauth) return null;
    throw new Error('Invalid Authorization header');
  }
  try {
    const decoded = await getAuth().verifyIdToken(token);
    return decoded;
  } catch (e) {
    if (allowUnauth) return null;
    throw new Error('Invalid Firebase ID token');
  }
}

// Normalise l’entrée en deux modes de prompt, tout en restant rétrocompatible
function normaliseInput(body: any): { type: CommandType; mode: PromptMode; data: { texte?: string; sections?: Record<string, string>; dominante?: string } } {
  const type = (body?.type ?? 'group') as CommandType;

  // Front payload actuel: { situation, type, extra }
  const texte = typeof body?.situation === 'string'
    ? body.situation
    : (typeof body?.texte === 'string' ? body.texte : undefined);

  const extra = (typeof body?.extra === 'object' && body?.extra) ? body.extra : {};

  // Compat: accepter aussi sections/dominante au niveau racine
  const sections = (typeof (extra as any)?.sections === 'object' && (extra as any)?.sections)
    ? (extra as any).sections
    : ((typeof body?.sections === 'object' && body?.sections) ? body.sections : undefined);

  const dominante = (typeof (extra as any)?.dominante === 'string')
    ? (extra as any).dominante
    : (typeof body?.dominante === 'string' ? body.dominante : undefined);

  let mode: PromptMode = 'texte_libre';
  if (sections && Object.keys(sections).length > 0) mode = 'elements_dictes';

  return { type, mode, data: { texte, sections, dominante } };
}

// Function HTTPS principale: /analyze
export const analyze = onRequest({ cors: true, region: 'europe-west1', timeoutSeconds: 120, secrets: [OPENAI_API_KEY] }, async (req, res) => {
  // CORS
  await new Promise<void>((resolve) => corsMw(req, res, () => resolve()));

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    await verifyIdTokenMaybe(req.headers['authorization'] as string | undefined);

    const { type, mode, data } = normaliseInput(req.body || {});

    const apiKey = OPENAI_API_KEY.value();
    if (!apiKey) {
      res.status(500).json({ error: 'OPENAI_API_KEY non configurée côté serveur (Secret Manager)' });
      return;
    }

    const openai = new OpenAI({ apiKey });

    // Prépare les prompts
    const system = DeveloperPrompts[type];
    const user = buildUserPrompt(type, mode, data);
    const { name, schema } = (OutputSchemas as any)[type];

    // Appelle Responses API en forçant JSON conforme au schéma
    const response = await openai.responses.create({
      model: 'gpt-4o-mini-2024-07-18',
      input: [
        { role: 'system', content: [{ type: 'text', text: system }] },
        { role: 'user', content: [{ type: 'text', text: user }] }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name, schema, strict: true }
      }
    });

    // Récupère le texte JSON retourné
    const text = response.output_text || '';
    // Compat: exposer `content` (nouveau) et `result` (ancien)
    res.json({ content: text, result: text, model: response.model });
  } catch (err: unknown) {
    console.error('[analyze] error', err);
    const msg = err instanceof Error ? err.message : 'Erreur serveur';
    res.status(400).json({ error: msg });
  }
});
