import OpenAI from 'openai';
import cors from 'cors';
import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { DeveloperPrompts, OutputSchemas, buildUserPrompt } from './prompts';
// Initialisation Admin (Firebase Functions)
try {
    initializeApp();
}
catch { }
const corsMw = cors({ origin: true });
// Utilitaire: vérifier (facultatif) le token Firebase du client
async function verifyIdTokenMaybe(authHeader) {
    const allowUnauth = process.env.ALLOW_UNAUTHENTICATED === 'true';
    if (!authHeader) {
        if (allowUnauth)
            return null;
        throw new Error('Missing Authorization header');
    }
    const [scheme, token] = authHeader.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
        if (allowUnauth)
            return null;
        throw new Error('Invalid Authorization header');
    }
    try {
        const decoded = await getAuth().verifyIdToken(token);
        return decoded;
    }
    catch (e) {
        if (allowUnauth)
            return null;
        throw new Error('Invalid Firebase ID token');
    }
}
// Normalise l’entrée en deux modes de prompt, tout en restant rétrocompatible
function normaliseInput(body) {
    const type = (body?.type ?? 'group');
    // Compat: l’app front envoie “situation” (texte libre) aujourd’hui
    const texte = typeof body?.situation === 'string' ? body.situation : undefined;
    const sections = typeof body?.sections === 'object' && body?.sections ? body.sections : undefined;
    const dominante = typeof body?.dominante === 'string' ? body.dominante : undefined;
    let mode = 'texte_libre';
    if (sections && Object.keys(sections).length > 0)
        mode = 'elements_dictes';
    return { type, mode, data: { texte, sections, dominante } };
}
// Function HTTPS principale: /analyze
export const analyze = onRequest({ cors: true, region: 'europe-west1', timeoutSeconds: 120 }, async (req, res) => {
    // CORS
    await new Promise((resolve) => corsMw(req, res, () => resolve()));
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }
    try {
        await verifyIdTokenMaybe(req.headers['authorization']);
        const { type, mode, data } = normaliseInput(req.body || {});
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            res.status(500).json({ error: 'OPENAI_API_KEY non configurée côté serveur' });
            return;
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
    }
    catch (err) {
        console.error('[analyze] error', err);
        const msg = err?.message || 'Erreur serveur';
        res.status(400).json({ error: msg });
    }
});
