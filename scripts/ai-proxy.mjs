import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const loadEnvFile = (relativePath) => {
  const absolutePath = resolve(process.cwd(), relativePath);
  if (!existsSync(absolutePath)) return;

  const content = readFileSync(absolutePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith('\'') && value.endsWith('\''))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
};

loadEnvFile('.env.proxy');

const PORT = Number(process.env.AI_PROXY_PORT || 8787);
const HOST = process.env.AI_PROXY_HOST || '127.0.0.1';
const ALLOWED_ORIGINS = (process.env.AI_PROXY_ALLOWED_ORIGINS || 'http://localhost:5174')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_COMMUNICATION_MODEL = process.env.OPENAI_COMMUNICATION_MODEL || OPENAI_MODEL;
const OPENAI_OPERATIONAL_PROMPT_ID = process.env.OPENAI_OPERATIONAL_PROMPT_ID || '';
const OPENAI_OPERATIONAL_PROMPT_VERSION = process.env.OPENAI_OPERATIONAL_PROMPT_VERSION || '';
const OPENAI_OPERATIONAL_VECTOR_STORE_ID = process.env.OPENAI_OPERATIONAL_VECTOR_STORE_ID || '';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const REQUIRE_AUTH = /^(1|true|yes)$/i.test(process.env.AI_PROXY_REQUIRE_AUTH || '');

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateLimitMap = new Map();

setInterval(() => {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
  for (const [key, timestamps] of rateLimitMap) {
    const fresh = timestamps.filter((t) => t > cutoff);
    if (fresh.length === 0) {
      rateLimitMap.delete(key);
    } else {
      rateLimitMap.set(key, fresh);
    }
  }
}, 5 * 60_000).unref();

const checkRateLimit = (userId, ip) => {
  const key = userId || ip || 'unknown';
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const timestamps = (rateLimitMap.get(key) || []).filter((t) => t > cutoff);
  if (timestamps.length >= RATE_LIMIT_MAX) {
    return false;
  }
  timestamps.push(now);
  rateLimitMap.set(key, timestamps);
  return true;
};

const getCorsOrigin = (requestOrigin) => {
  if (typeof requestOrigin === 'string' && ALLOWED_ORIGINS.includes(requestOrigin)) {
    return requestOrigin;
  }
  return ALLOWED_ORIGINS[0];
};

const buildJsonHeaders = (requestOrigin) => ({
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': getCorsOrigin(requestOrigin),
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
});

const ROLE_LABELS = {
  group: 'Chef de groupe',
  column: 'Chef de colonne',
  site: 'Chef de site'
};

const SUPPORTED_TYPES = new Set(['group', 'column', 'site', 'communication']);

const normalizeText = (value, fallback = '') => (
  typeof value === 'string' ? value.trim() : fallback
);

const normalizeTextList = (value) => (
  Array.isArray(value)
    ? value.map((item) => normalizeText(item)).filter(Boolean)
    : []
);

const isPlainObject = (value) => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const serializeDoctrineContext = (value) => {
  if (typeof value === 'string') return value.trim();
  if (!isPlainObject(value)) return '';

  const sections = [];
  const orderedKeys = [
    'principes_cles',
    'objectifs',
    'idees_manoeuvre',
    'moyens_standards_td',
    'contexte'
  ];
  const entries = orderedKeys
    .filter((key) => key in value)
    .map((key) => [key, value[key]]);

  for (const [key, rawSection] of entries) {
    if (typeof rawSection === 'string') {
      const content = rawSection.trim();
      if (content) sections.push(`${key}:\n- ${content}`);
      continue;
    }

    if (Array.isArray(rawSection)) {
      const items = rawSection
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean);
      if (items.length) {
        sections.push(`${key}:\n${items.map((item) => `- ${item}`).join('\n')}`);
      }
    }
  }

  return sections.join('\n\n');
};

const buildJsonResponse = (res, status, payload, requestOrigin) => {
  res.writeHead(status, buildJsonHeaders(requestOrigin));
  res.end(JSON.stringify(payload));
};

const readRequestBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  return JSON.parse(raw);
};

const extractBearerToken = (authorizationHeader) => {
  if (typeof authorizationHeader !== 'string') return null;
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};

const verifySupabaseToken = async (authorizationHeader) => {
  const token = extractBearerToken(authorizationHeader);
  if (!token) {
    return {
      ok: !REQUIRE_AUTH,
      mode: 'missing',
      userId: null,
      error: REQUIRE_AUTH ? 'Jeton Supabase manquant.' : null
    };
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return {
      ok: !REQUIRE_AUTH,
      mode: 'skipped',
      userId: null,
      error: REQUIRE_AUTH ? 'SUPABASE_URL ou SUPABASE_ANON_KEY manquante(s).' : null
    };
  }

  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      ok: false,
      mode: 'rejected',
      userId: null,
      error: `Jeton Supabase refusé (${response.status}): ${errorText || response.statusText}`
    };
  }

  const user = await response.json();
  return {
    ok: true,
    mode: 'verified',
    userId: typeof user?.id === 'string' ? user.id : null,
    error: null
  };
};

const MANEUVER_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    mission: { type: 'string' },
    moyen: { type: 'string' },
    moyen_supp: { type: 'string' },
    details: { type: 'string' },
    objective_id: { type: 'string' },
    order_in_objective: { type: 'integer' },
    color: { type: 'string' }
  },
  required: ['mission', 'moyen', 'moyen_supp', 'details', 'objective_id', 'order_in_objective', 'color'],
  additionalProperties: false
};

const ORDER_SCHEMA = {
  type: 'object',
  properties: {
    S: { type: 'string' },
    A: { type: 'array', items: { type: 'string' } },
    O: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['objective'] },
          id: { type: 'string' },
          content: { type: 'string' }
        },
        required: ['type', 'id', 'content'],
        additionalProperties: false
      }
    },
    I: { type: 'array', items: MANEUVER_ITEM_SCHEMA },
    E: { type: 'array', items: MANEUVER_ITEM_SCHEMA },
    L: { type: 'array', items: { type: 'string' } },
    C: { type: 'string' }
  },
  required: ['S', 'A', 'O', 'I', 'E', 'L', 'C'],
  additionalProperties: false
};

const buildOperationalPrompt = (payload) => {
  const roleLabel = ROLE_LABELS[payload.type] || 'Chef de groupe';
  const secondaryRisks = normalizeTextList(payload.secondaryRisks);
  const doctrineContext = serializeDoctrineContext(payload.doctrine_context);
  return [
    `Rôle: ${roleLabel}`,
    `Dominante: ${normalizeText(payload.dominante, 'Non précisée')}`,
    `Risques secondaires: ${secondaryRisks.length ? secondaryRisks.join(', ') : 'Aucun'}`,
    payload.extraContext ? `Contexte complémentaire: ${normalizeText(payload.extraContext)}` : null,
    doctrineContext ? `Doctrine contextuelle:\n${doctrineContext}` : null,
    'Consignes tactiques:',
    '- Produis un ordre initial de secours structuré, bref, doctrinal et immédiatement exploitable.',
    '- N invente jamais de faits certains si absents. Si une information critique manque, traite-la comme une incertitude à lever.',
    '- Raisonner avec la grille Source -> Flux -> Cibles et prioriser: sauvetage / mise en sécurité, réduction de la menace, protection des biens et de l environnement.',
    '- Utilise prioritairement les formulations doctrinales fournies dans la doctrine si elles sont pertinentes pour la situation.',
    '- La section S doit contenir uniquement les faits observés ou raisonnablement déduits, sans ordre ni moyen engagé.',
    '- La section O contient au maximum 3 objectifs, chacun avec un verbe à l infinitif, directement déduits de S.',
    '- La section I décrit comment atteindre les objectifs. Ne cite pas d engin si ce n est pas indispensable. Lie chaque idée à objective_id quand possible.',
    '- La section E traduit les idées en missions concrètes attribuées à des moyens cohérents. Utilise la nomenclature des groupes constitués si la doctrine la fournit et qu un renfort est nécessaire.',
    '- La section C reste limitée au niveau chef de groupe.',
    'Consignes de structure:',
    '- Crée des objectifs avec ids stables de la forme OBJ-1, OBJ-2, OBJ-3.',
    '- Chaque item de O doit respecter exactement la forme { "type": "objective", "id": "...", "content": "..." }.',
    '- Lie les idées de manoeuvre et missions à objective_id. Utilise une chaîne vide si non lié.',
    '- order_in_objective commence à 1 pour les éléments liés, sinon 0.',
    '- moyen peut rester vide si le moyen n est pas connu.',
    '- moyen_supp, details et color doivent être présents et peuvent être des chaînes vides.',
    '- Respecte strictement le schéma JSON demandé. Aucun champ supplémentaire.',
    '',
    'Situation brute:',
    normalizeText(payload.situation)
  ].filter(Boolean).join('\n');
};

const buildCommunicationPrompt = (payload) => {
  const secondaryRisks = normalizeTextList(payload.secondaryRisks);
  return [
    'Tu aides un officier de secours a reformuler un message de situation.',
    'Redige en francais, sous forme de sections courtes en Markdown.',
    'Sections attendues:',
    '- Engagement des secours',
    '- Situation a l appel',
    '- Situation a l arrivee',
    '- Nombre de victimes',
    '- Moyens engages',
    '- Actions de secours',
    '- Conseils a la population',
    'Sois factuel et prudent quand une information manque.',
    '',
    `Dominante: ${normalizeText(payload.dominante, 'Non precisee')}`,
    `Risques secondaires: ${secondaryRisks.length ? secondaryRisks.join(', ') : 'Aucun'}`,
    payload.extraContext ? `Contexte complementaire: ${normalizeText(payload.extraContext)}` : null,
    '',
    'Situation brute:',
    normalizeText(payload.situation)
  ].filter(Boolean).join('\n');
};

const buildOperationalPromptVariables = (payload) => ({
  type_risque_principal: normalizeText(payload.dominante),
  types_risque_secondaires: normalizeTextList(payload.secondaryRisks).join(', '),
  description_situation: normalizeText(payload.situation),
  contexte_complementaire: normalizeText(payload.extraContext)
});

const shouldUseHostedOperationalPrompt = (payload) => (
  payload?.type === 'group'
  && Boolean(OPENAI_OPERATIONAL_PROMPT_ID)
  && Boolean(OPENAI_OPERATIONAL_VECTOR_STORE_ID)
);

const callOpenAI = async (body) => {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const rawText = await response.text();
  const payload = rawText ? JSON.parse(rawText) : {};
  if (!response.ok) {
    const message = typeof payload?.error?.message === 'string'
      ? payload.error.message
      : rawText || response.statusText;
    throw new Error(`OpenAI ${response.status}: ${message}`);
  }

  return payload;
};

const extractOutputText = (responsePayload) => {
  if (typeof responsePayload?.output_text === 'string' && responsePayload.output_text.trim()) {
    return responsePayload.output_text.trim();
  }

  const fragments = [];
  const outputItems = Array.isArray(responsePayload?.output) ? responsePayload.output : [];
  for (const item of outputItems) {
    const contentItems = Array.isArray(item?.content) ? item.content : [];
    for (const content of contentItems) {
      if (content?.type === 'output_text' && typeof content?.text === 'string') {
        fragments.push(content.text);
      }
    }
  }

  return fragments.join('\n').trim();
};

const normalizeOperationalOrder = (parsed) => {
  const objectives = Array.isArray(parsed?.O) ? parsed.O : [];
  const maneuverItems = Array.isArray(parsed?.I) ? parsed.I : [];
  const executionItems = Array.isArray(parsed?.E) ? parsed.E : [];

  return {
    S: normalizeText(parsed?.S, 'Situation non renseignee'),
    A: normalizeTextList(parsed?.A),
    O: objectives.map((objective, index) => ({
      type: 'objective',
      id: normalizeText(objective?.id, `OBJ-${index + 1}`),
      content: normalizeText(objective?.content, `Objectif ${index + 1}`)
    })),
    I: maneuverItems.map((item) => ({
      mission: normalizeText(item?.mission),
      moyen: normalizeText(item?.moyen),
      moyen_supp: normalizeText(item?.moyen_supp),
      details: normalizeText(item?.details),
      objective_id: normalizeText(item?.objective_id),
      order_in_objective: Number.isInteger(item?.order_in_objective) ? item.order_in_objective : 0,
      color: normalizeText(item?.color)
    })),
    E: executionItems.map((item) => ({
      mission: normalizeText(item?.mission),
      moyen: normalizeText(item?.moyen),
      moyen_supp: normalizeText(item?.moyen_supp),
      details: normalizeText(item?.details),
      objective_id: normalizeText(item?.objective_id),
      order_in_objective: Number.isInteger(item?.order_in_objective) ? item.order_in_objective : 0,
      color: normalizeText(item?.color)
    })),
    L: normalizeTextList(parsed?.L),
    C: normalizeText(parsed?.C, 'Commandement non renseigne')
  };
};

const analyzeOperational = async (payload) => {
  const useHostedPrompt = shouldUseHostedOperationalPrompt(payload);
  const requestBody = useHostedPrompt
    ? {
        model: OPENAI_MODEL,
        prompt: {
          id: OPENAI_OPERATIONAL_PROMPT_ID,
          ...(OPENAI_OPERATIONAL_PROMPT_VERSION ? { version: OPENAI_OPERATIONAL_PROMPT_VERSION } : {}),
          variables: buildOperationalPromptVariables(payload)
        },
        tools: [
          {
            type: 'file_search',
            vector_store_ids: [OPENAI_OPERATIONAL_VECTOR_STORE_ID]
          }
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'atlas_operational_order',
            schema: ORDER_SCHEMA,
            strict: true
          }
        }
      }
    : {
        model: OPENAI_MODEL,
        input: [
          {
            role: 'system',
            content: 'Tu rediges des ordres initiaux de secours francais. Reponds uniquement dans le schema JSON demande.'
          },
          {
            role: 'user',
            content: buildOperationalPrompt(payload)
          }
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'atlas_operational_order',
            schema: ORDER_SCHEMA,
            strict: true
          }
        }
      };

  const responsePayload = await callOpenAI(requestBody);

  const outputText = extractOutputText(responsePayload);
  if (!outputText) {
    throw new Error('OpenAI a retourne une reponse vide.');
  }

  return {
    result: normalizeOperationalOrder(JSON.parse(outputText)),
    model: responsePayload?.model || OPENAI_MODEL,
    source: useHostedPrompt ? 'hosted-prompt' : 'local-proxy-prompt'
  };
};

const analyzeCommunication = async (payload) => {
  const responsePayload = await callOpenAI({
    model: OPENAI_COMMUNICATION_MODEL,
    input: [
      {
        role: 'system',
        content: 'Tu assistes la redaction d un message operationnel de secours. Reponds en Markdown clair et compact.'
      },
      {
        role: 'user',
        content: buildCommunicationPrompt(payload)
      }
    ]
  });

  const outputText = extractOutputText(responsePayload);
  if (!outputText) {
    throw new Error('OpenAI a retourne une reponse vide.');
  }

  return {
    result: outputText,
    model: responsePayload?.model || OPENAI_COMMUNICATION_MODEL
  };
};

const handleHealth = async (req, res) => {
  const auth = await verifySupabaseToken(req.headers.authorization);
  const hasOpenAIKey = Boolean(OPENAI_API_KEY);
  const status = hasOpenAIKey ? 200 : 503;
  buildJsonResponse(res, status, {
    ok: hasOpenAIKey && auth.ok,
    message: hasOpenAIKey ? 'Proxy pret.' : 'OPENAI_API_KEY manquante.',
    service: 'atlas-ai-proxy',
    auth: auth.mode,
    auth_required: REQUIRE_AUTH,
    auth_error: auth.error,
    openai_configured: hasOpenAIKey,
    supabase_auth_configured: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY),
    model: OPENAI_MODEL,
    communication_model: OPENAI_COMMUNICATION_MODEL,
    operational_prompt_configured: Boolean(OPENAI_OPERATIONAL_PROMPT_ID),
    operational_vector_store_configured: Boolean(OPENAI_OPERATIONAL_VECTOR_STORE_ID),
    operational_prompt_id: OPENAI_OPERATIONAL_PROMPT_ID || null,
    operational_prompt_version: OPENAI_OPERATIONAL_PROMPT_VERSION || null,
    timestamp: new Date().toISOString()
  }, req.headers.origin);
};

const handleAnalyze = async (req, res) => {
  const requestOrigin = req.headers.origin;

  if (!OPENAI_API_KEY) {
    buildJsonResponse(res, 503, {
      error: 'OPENAI_API_KEY manquante sur le proxy.'
    }, requestOrigin);
    return;
  }

  const auth = await verifySupabaseToken(req.headers.authorization);
  if (!auth.ok) {
    buildJsonResponse(res, 401, {
      error: auth.error || 'Authentification invalide.'
    }, requestOrigin);
    return;
  }

  const clientIp = req.socket?.remoteAddress || 'unknown';
  if (!checkRateLimit(auth.userId, clientIp)) {
    buildJsonResponse(res, 429, {
      error: 'Trop de requêtes. Veuillez patienter.'
    }, requestOrigin);
    return;
  }

  const payload = await readRequestBody(req);
  const type = normalizeText(payload?.type);
  const situation = normalizeText(payload?.situation);

  if (!SUPPORTED_TYPES.has(type)) {
    buildJsonResponse(res, 400, {
      error: 'Type d analyse invalide.'
    }, requestOrigin);
    return;
  }

  if (!situation) {
    buildJsonResponse(res, 400, {
      error: 'Le champ situation est requis.'
    }, requestOrigin);
    return;
  }

  const analysis = type === 'communication'
    ? await analyzeCommunication(payload)
    : await analyzeOperational(payload);

  buildJsonResponse(res, 200, {
    result: analysis.result,
    meta: {
      model: analysis.model,
      source: analysis.source || 'local-proxy-prompt',
      auth: auth.mode,
      user_id: auth.userId,
      proxy: 'local-node'
    }
  }, requestOrigin);
};

const server = createServer(async (req, res) => {
  const requestOrigin = req.headers.origin;
  try {
    if (!req.url) {
      buildJsonResponse(res, 400, { error: 'URL manquante.' }, requestOrigin);
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);

    if (req.method === 'OPTIONS') {
      res.writeHead(204, buildJsonHeaders(requestOrigin));
      res.end();
      return;
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      await handleHealth(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/analyze') {
      await handleAnalyze(req, res);
      return;
    }

    buildJsonResponse(res, 404, {
      error: 'Route introuvable.'
    }, requestOrigin);
  } catch (error) {
    console.error('[atlas-ai-proxy] fatal error', error);
    const message = error instanceof Error ? error.message : 'Erreur interne du proxy.';
    buildJsonResponse(res, 500, {
      error: message
    }, requestOrigin);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[atlas-ai-proxy] listening on http://${HOST}:${PORT}`);
  console.log(`[atlas-ai-proxy] health endpoint: http://${HOST}:${PORT}/health`);
});
