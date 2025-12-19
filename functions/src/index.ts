import OpenAI from 'openai';
import cors from 'cors';
import { onRequest } from 'firebase-functions/v2/https';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { CommandType, PromptMode } from './prompts';
import { DeveloperPrompts, OutputSchemas, buildUserPrompt } from './prompts';

class HttpError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

// Initialisation Admin (Firebase Functions)
if (!getApps().length) {
  initializeApp();
}

const corsMw = cors({ origin: true });

// Utilitaire: vérifier (facultatif) le token Firebase du client
async function verifyIdTokenMaybe(authHeader?: string) {
  const allowUnauth = process.env.ALLOW_UNAUTHENTICATED === 'true';
  if (!authHeader) {
    if (allowUnauth) return null;
    throw new HttpError('Missing Authorization header', 401);
  }
  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    if (allowUnauth) return null;
    throw new HttpError('Invalid Authorization header', 401);
  }
  try {
    const decoded = await getAuth().verifyIdToken(token);
    return decoded;
  } catch {
    if (allowUnauth) return null;
    throw new HttpError('Invalid Firebase ID token', 401);
  }
}

// Normalise l’entrée en deux modes de prompt, tout en restant rétrocompatible
function normaliseInput(body: unknown): { type: CommandType; mode: PromptMode; data: { texte?: string; sections?: Record<string, string>; dominante?: string } } {
  const payload = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;

  const rawType = payload.type;
  const allowedTypes: CommandType[] = ['group', 'column', 'site', 'communication'];
  const type = allowedTypes.includes(rawType as CommandType) ? (rawType as CommandType) : 'group';

  // Compat: l’app front envoie “situation” (texte libre) aujourd’hui
  const texte = typeof payload.situation === 'string' ? payload.situation : undefined;

  const sections =
    payload.sections && typeof payload.sections === 'object'
      ? Object.entries(payload.sections as Record<string, unknown>)
          .filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
          .reduce<Record<string, string>>((acc, [key, value]) => {
            acc[key] = (value as string).trim();
            return acc;
          }, {})
      : undefined;

  const dominante = typeof payload.dominante === 'string' ? payload.dominante.trim() : undefined;

  if (!texte && (!sections || Object.keys(sections).length === 0)) {
    throw new HttpError('Le contenu de la situation ou des sections est requis.');
  }

  let mode: PromptMode = 'texte_libre';
  if (sections && Object.keys(sections).length > 0) mode = 'elements_dictes';
  return { type, mode, data: { texte, sections, dominante } };
}

// Function HTTPS principale: /analyze
export const analyze = onRequest({ cors: true, region: 'europe-west1', timeoutSeconds: 120 }, async (req, res) => {
  // CORS
  await new Promise<void>((resolve) => corsMw(req, res, () => resolve()));

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    await verifyIdTokenMaybe(req.headers['authorization'] as string | undefined);

    const { type, mode, data } = normaliseInput(req.body || {});

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new HttpError('OPENAI_API_KEY non configurée côté serveur', 500);
    }

    const openai = new OpenAI({ apiKey });

    // Prépare les prompts
    const system = DeveloperPrompts[type];
    const user = buildUserPrompt(type, mode, data);
    const { name, schema } = OutputSchemas[type];

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
    res.json({ result: text, model: response.model });
  } catch (err: unknown) {
    console.error('[analyze] error', err);
    const status = err instanceof HttpError ? err.status : 400;
    const msg = err instanceof Error ? err.message : 'Erreur serveur';
    res.status(status).json({ error: msg });
  }
});
