import OpenAI from 'openai';
import cors from 'cors';
import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { DeveloperPrompts, OutputSchemas, buildUserPrompt } from './prompts.js';
// Initialisation Admin (Firebase Functions)
try {
    initializeApp();
}
catch { }
const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY');
const corsMw = cors({
    origin: true,
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
});
// Utilitaire: vérifier le token Firebase du client
async function verifyIdToken(authHeader) {
    if (!authHeader)
        throw new Error('Missing Authorization header');
    const [scheme, token] = authHeader.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token)
        throw new Error('Invalid Authorization header');
    try {
        return await getAuth().verifyIdToken(token);
    }
    catch (e) {
        throw new Error('Invalid Firebase ID token');
    }
}
// Normalise l’entrée en deux modes de prompt, tout en restant rétrocompatible
function normaliseInput(body) {
    const extra = typeof body?.extra === 'object' && body?.extra ? body.extra : {};
    const type = (body?.type ?? extra?.type ?? 'group');
    const texte = typeof body?.situation === 'string' ? body.situation : undefined;
    const rawSections = typeof body?.sections === 'object' && body?.sections
        ? body.sections
        : (typeof extra?.sections === 'object' && extra.sections ? extra.sections : undefined);
    const sections = rawSections
        ? (() => {
            const entries = Object.entries(rawSections)
                .filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
                .map(([k, v]) => [k, v.trim()]);
            return entries.length ? Object.fromEntries(entries) : undefined;
        })()
        : undefined;
    const dominante = typeof body?.dominante === 'string'
        ? body.dominante
        : (typeof extra?.dominante === 'string' ? extra.dominante : undefined);
    const extraContext = typeof extra?.extraContext === 'string' ? extra.extraContext.trim() : undefined;
    const secondaryRisks = Array.isArray(extra?.secondaryRisks)
        ? extra.secondaryRisks.filter((r) => typeof r === 'string')
        : undefined;
    let mode = 'texte_libre';
    if (sections && Object.keys(sections).length > 0)
        mode = 'elements_dictes';
    return { type, mode, data: { texte, sections, dominante, extraContext, secondaryRisks } };
}
// Function HTTPS principale: /analyze
export const analyze = onRequest({
    cors: true,
    region: 'europe-west1',
    timeoutSeconds: 120,
    secrets: [OPENAI_API_KEY]
}, async (req, res) => {
    // CORS
    await new Promise((resolve) => corsMw(req, res, () => resolve()));
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }
    try {
        await verifyIdToken(req.headers['authorization']);
        const { type, mode, data } = normaliseInput(req.body || {});
        const apiKey = OPENAI_API_KEY.value();
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
                { role: 'system', content: [{ type: 'input_text', text: system }] },
                { role: 'user', content: [{ type: 'input_text', text: user }] }
            ],
            // Types du SDK 4.28.0 n’exposent pas encore response_format sur Responses API : on force le typage.
            response_format: {
                type: 'json_schema',
                json_schema: { name, schema, strict: true }
            }
        });
        // Récupère le texte JSON retourné (output_text prioritaire, fallback sur premier bloc textuel)
        const text = response.output_text ||
            (Array.isArray(response.output)
                ? response.output
                    .flatMap((item) => Array.isArray(item.content) ? item.content : [])
                    .find((c) => typeof c.text === 'string')?.text
                : '') ||
            '';
        res.json({ content: text, result: text, model: response.model });
    }
    catch (err) {
        console.error('[analyze] error', err);
        const msg = err?.message || 'Erreur serveur';
        const status = msg.includes('Authorization') || msg.includes('token') ? 401 : 400;
        res.status(status).json({ error: msg });
    }
});
