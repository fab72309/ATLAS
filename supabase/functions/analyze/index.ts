type AnalysisType = 'group' | 'column' | 'site' | 'communication';

type OperationalTabId = 'group' | 'column' | 'site';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini';
const OPENAI_COMMUNICATION_MODEL = Deno.env.get('OPENAI_COMMUNICATION_MODEL') ?? OPENAI_MODEL;
const OPENAI_OPERATIONAL_PROMPT_ID = Deno.env.get('OPENAI_OPERATIONAL_PROMPT_ID') ?? '';
const OPENAI_OPERATIONAL_PROMPT_VERSION = Deno.env.get('OPENAI_OPERATIONAL_PROMPT_VERSION') ?? '';
const OPENAI_OPERATIONAL_VECTOR_STORE_ID = Deno.env.get('OPENAI_OPERATIONAL_VECTOR_STORE_ID') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const REQUIRE_AUTH = /^(1|true|yes)$/i.test(Deno.env.get('AI_PROXY_REQUIRE_AUTH') ?? '');

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
};

const ROLE_LABELS: Record<OperationalTabId, string> = {
  group: 'Chef de groupe',
  column: 'Chef de colonne',
  site: 'Chef de site',
};

const SUPPORTED_TYPES = new Set<AnalysisType>(['group', 'column', 'site', 'communication']);

const MANEUVER_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    mission: { type: 'string' },
    moyen: { type: 'string' },
    moyen_supp: { type: 'string' },
    details: { type: 'string' },
    objective_id: { type: 'string' },
    order_in_objective: { type: 'integer' },
    color: { type: 'string' },
  },
  required: ['mission', 'moyen', 'moyen_supp', 'details', 'objective_id', 'order_in_objective', 'color'],
  additionalProperties: false,
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
          content: { type: 'string' },
        },
        required: ['type', 'id', 'content'],
        additionalProperties: false,
      },
    },
    I: { type: 'array', items: MANEUVER_ITEM_SCHEMA },
    E: { type: 'array', items: MANEUVER_ITEM_SCHEMA },
    L: { type: 'array', items: { type: 'string' } },
    C: { type: 'string' },
  },
  required: ['S', 'A', 'O', 'I', 'E', 'L', 'C'],
  additionalProperties: false,
};

const normalizeText = (value: unknown, fallback = ''): string => (
  typeof value === 'string' ? value.trim() : fallback
);

const normalizeTextList = (value: unknown): string[] => (
  Array.isArray(value)
    ? value.map((item) => normalizeText(item)).filter(Boolean)
    : []
);

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const buildJsonResponse = (status: number, payload: unknown) => (
  new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS })
);

const extractBearerToken = (authorizationHeader: string | null) => {
  if (typeof authorizationHeader !== 'string') return null;
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};

const serializeDoctrineContext = (value: unknown) => {
  if (typeof value === 'string') return value.trim();
  if (!isPlainObject(value)) return '';

  const sections: string[] = [];
  const orderedKeys = [
    'principes_cles',
    'objectifs',
    'idees_manoeuvre',
    'moyens_standards_td',
    'contexte',
  ];

  for (const key of orderedKeys) {
    const rawSection = value[key];
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

const verifySupabaseToken = async (authorizationHeader: string | null) => {
  const token = extractBearerToken(authorizationHeader);
  if (!token) {
    return {
      ok: !REQUIRE_AUTH,
      mode: 'missing',
      userId: null,
      error: REQUIRE_AUTH ? 'Jeton Supabase manquant.' : null,
    };
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return {
      ok: !REQUIRE_AUTH,
      mode: 'skipped',
      userId: null,
      error: REQUIRE_AUTH ? 'SUPABASE_URL ou SUPABASE_ANON_KEY manquante(s).' : null,
    };
  }

  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      ok: false,
      mode: 'rejected',
      userId: null,
      error: `Jeton Supabase refusé (${response.status}): ${errorText || response.statusText}`,
    };
  }

  const user = await response.json();
  return {
    ok: true,
    mode: 'verified',
    userId: typeof user?.id === 'string' ? user.id : null,
    error: null,
  };
};

const buildOperationalPrompt = (payload: Record<string, unknown>) => {
  const type = normalizeText(payload.type) as OperationalTabId;
  const roleLabel = ROLE_LABELS[type] || 'Chef de groupe';
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
    normalizeText(payload.situation),
  ].filter(Boolean).join('\n');
};

const buildCommunicationPrompt = (payload: Record<string, unknown>) => {
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
    normalizeText(payload.situation),
  ].filter(Boolean).join('\n');
};

const buildOperationalPromptVariables = (payload: Record<string, unknown>) => ({
  type_risque_principal: normalizeText(payload.dominante),
  types_risque_secondaires: normalizeTextList(payload.secondaryRisks).join(', '),
  description_situation: normalizeText(payload.situation),
  contexte_complementaire: normalizeText(payload.extraContext),
});

const shouldUseHostedOperationalPrompt = (payload: Record<string, unknown>) => (
  payload.type === 'group'
  && Boolean(OPENAI_OPERATIONAL_PROMPT_ID)
  && Boolean(OPENAI_OPERATIONAL_VECTOR_STORE_ID)
);

const callOpenAI = async (body: Record<string, unknown>) => {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
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

const extractOutputText = (responsePayload: Record<string, unknown>) => {
  if (typeof responsePayload.output_text === 'string' && responsePayload.output_text.trim()) {
    return responsePayload.output_text.trim();
  }

  const fragments: string[] = [];
  const outputItems = Array.isArray(responsePayload.output) ? responsePayload.output : [];
  for (const item of outputItems) {
    const contentItems = isPlainObject(item) && Array.isArray(item.content) ? item.content : [];
    for (const content of contentItems) {
      if (isPlainObject(content) && content.type === 'output_text' && typeof content.text === 'string') {
        fragments.push(content.text);
      }
    }
  }

  return fragments.join('\n').trim();
};

const normalizeOperationalOrder = (parsed: Record<string, unknown>) => {
  const objectives = Array.isArray(parsed.O) ? parsed.O : [];
  const maneuverItems = Array.isArray(parsed.I) ? parsed.I : [];
  const executionItems = Array.isArray(parsed.E) ? parsed.E : [];

  return {
    S: normalizeText(parsed.S, 'Situation non renseignee'),
    A: normalizeTextList(parsed.A),
    O: objectives.map((objective, index) => ({
      type: 'objective',
      id: isPlainObject(objective) ? normalizeText(objective.id, `OBJ-${index + 1}`) : `OBJ-${index + 1}`,
      content: isPlainObject(objective) ? normalizeText(objective.content, `Objectif ${index + 1}`) : `Objectif ${index + 1}`,
    })),
    I: maneuverItems.map((item) => ({
      mission: isPlainObject(item) ? normalizeText(item.mission) : '',
      moyen: isPlainObject(item) ? normalizeText(item.moyen) : '',
      moyen_supp: isPlainObject(item) ? normalizeText(item.moyen_supp) : '',
      details: isPlainObject(item) ? normalizeText(item.details) : '',
      objective_id: isPlainObject(item) ? normalizeText(item.objective_id) : '',
      order_in_objective: isPlainObject(item) && Number.isInteger(item.order_in_objective) ? item.order_in_objective : 0,
      color: isPlainObject(item) ? normalizeText(item.color) : '',
    })),
    E: executionItems.map((item) => ({
      mission: isPlainObject(item) ? normalizeText(item.mission) : '',
      moyen: isPlainObject(item) ? normalizeText(item.moyen) : '',
      moyen_supp: isPlainObject(item) ? normalizeText(item.moyen_supp) : '',
      details: isPlainObject(item) ? normalizeText(item.details) : '',
      objective_id: isPlainObject(item) ? normalizeText(item.objective_id) : '',
      order_in_objective: isPlainObject(item) && Number.isInteger(item.order_in_objective) ? item.order_in_objective : 0,
      color: isPlainObject(item) ? normalizeText(item.color) : '',
    })),
    L: normalizeTextList(parsed.L),
    C: normalizeText(parsed.C, 'Commandement non renseigne'),
  };
};

const analyzeOperational = async (payload: Record<string, unknown>) => {
  const useHostedPrompt = shouldUseHostedOperationalPrompt(payload);
  const requestBody = useHostedPrompt
    ? {
        model: OPENAI_MODEL,
        prompt: {
          id: OPENAI_OPERATIONAL_PROMPT_ID,
          ...(OPENAI_OPERATIONAL_PROMPT_VERSION ? { version: OPENAI_OPERATIONAL_PROMPT_VERSION } : {}),
          variables: buildOperationalPromptVariables(payload),
        },
        tools: [
          {
            type: 'file_search',
            vector_store_ids: [OPENAI_OPERATIONAL_VECTOR_STORE_ID],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'atlas_operational_order',
            schema: ORDER_SCHEMA,
            strict: true,
          },
        },
      }
    : {
        model: OPENAI_MODEL,
        input: [
          {
            role: 'system',
            content: 'Tu rediges des ordres initiaux de secours francais. Reponds uniquement dans le schema JSON demande.',
          },
          {
            role: 'user',
            content: buildOperationalPrompt(payload),
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'atlas_operational_order',
            schema: ORDER_SCHEMA,
            strict: true,
          },
        },
      };

  const responsePayload = await callOpenAI(requestBody);
  const outputText = extractOutputText(responsePayload);
  if (!outputText) {
    throw new Error('OpenAI a retourne une reponse vide.');
  }

  return {
    result: normalizeOperationalOrder(JSON.parse(outputText)),
    model: typeof responsePayload.model === 'string' ? responsePayload.model : OPENAI_MODEL,
    source: useHostedPrompt ? 'hosted-prompt' : 'supabase-edge-function',
  };
};

const analyzeCommunication = async (payload: Record<string, unknown>) => {
  const responsePayload = await callOpenAI({
    model: OPENAI_COMMUNICATION_MODEL,
    input: [
      {
        role: 'system',
        content: 'Tu assistes la redaction d un message operationnel de secours. Reponds en Markdown clair et compact.',
      },
      {
        role: 'user',
        content: buildCommunicationPrompt(payload),
      },
    ],
  });

  const outputText = extractOutputText(responsePayload);
  if (!outputText) {
    throw new Error('OpenAI a retourne une reponse vide.');
  }

  return {
    result: outputText,
    model: typeof responsePayload.model === 'string' ? responsePayload.model : OPENAI_COMMUNICATION_MODEL,
    source: 'supabase-edge-function',
  };
};

Deno.serve(async (request) => {
  try {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: JSON_HEADERS });
    }

    const url = new URL(request.url);

    if (request.method === 'GET' && (url.pathname.endsWith('/health') || url.pathname.endsWith('/analyze/health'))) {
      const auth = await verifySupabaseToken(request.headers.get('authorization'));
      const hasOpenAIKey = Boolean(OPENAI_API_KEY);
      const status = hasOpenAIKey ? 200 : 503;

      return buildJsonResponse(status, {
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
        timestamp: new Date().toISOString(),
      });
    }

    if (request.method === 'POST' && url.pathname.endsWith('/analyze')) {
      if (!OPENAI_API_KEY) {
        return buildJsonResponse(503, {
          error: 'OPENAI_API_KEY manquante sur le proxy.',
        });
      }

      const auth = await verifySupabaseToken(request.headers.get('authorization'));
      if (!auth.ok) {
        return buildJsonResponse(401, {
          error: auth.error || 'Authentification invalide.',
        });
      }

      const payload = await request.json().catch(() => ({})) as Record<string, unknown>;
      const type = normalizeText(payload.type) as AnalysisType;
      const situation = normalizeText(payload.situation);

      if (!SUPPORTED_TYPES.has(type)) {
        return buildJsonResponse(400, {
          error: 'Type d analyse invalide.',
        });
      }

      if (!situation) {
        return buildJsonResponse(400, {
          error: 'Le champ situation est requis.',
        });
      }

      const analysis = type === 'communication'
        ? await analyzeCommunication(payload)
        : await analyzeOperational(payload);

      return buildJsonResponse(200, {
        result: analysis.result,
        meta: {
          model: analysis.model,
          source: analysis.source,
          auth: auth.mode,
          user_id: auth.userId,
          proxy: 'supabase-edge-function',
        },
      });
    }

    return buildJsonResponse(404, {
      error: 'Route introuvable.',
    });
  } catch (error) {
    console.error('[atlas-ai-proxy] fatal error', error);
    const message = error instanceof Error ? error.message : 'Erreur interne du proxy.';
    return buildJsonResponse(500, {
      error: message,
    });
  }
});
