import { getSupabaseClient } from './supabaseClient';
import { readAppSettings } from './appSettings';

const normalizeTitle = (title: string) => (
  title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
);

const mapSectionTitleToKey = (title: string) => {
  const normalized = normalizeTitle(title);
  if (normalized.includes('situation')) return 'S';
  if (normalized.includes('anticipation')) return 'A';
  if (normalized.includes('objectif')) return 'O';
  if (normalized.includes('idee') || normalized.includes('manoeuvre')) return 'I';
  if (normalized.includes('execution')) return 'E';
  if (normalized.includes('commandement')) return 'C';
  if (normalized.includes('logistique')) return 'L';
  return null;
};

const parseJsonSafely = (value: string): unknown | null => {
  try {
    const cleaned = value.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const trimToNull = (value?: string | null) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
};

const deriveHealthUrl = (value: string) => {
  try {
    const url = new URL(value);
    if (url.pathname.endsWith('/analyze')) {
      url.pathname = url.pathname.replace(/\/analyze$/, '/health');
      return url.toString();
    }
  } catch {
    return value;
  }
  return value;
};

export type OpenAIProxySource = 'settings' | 'env' | 'missing';

export type OpenAIProxyConfig = {
  envUrl: string | null;
  overrideUrl: string | null;
  url: string | null;
  source: OpenAIProxySource;
};

export type OpenAIProxyHealth = {
  ok: boolean;
  reachable: boolean;
  url: string | null;
  source: OpenAIProxySource;
  status: number | null;
  statusText: string | null;
  hasAuthToken: boolean;
  message: string;
  payload?: unknown;
};

const LEGACY_PROXY_ERROR_PATTERNS = [
  /invalid firebase id token/i,
  /firebase id token/i,
  /firebase/i,
  /bearer token/i,
  /authentification invalide/i,
  /token .*invalide/i
];

const isLegacyProxyAuthError = (value: string) => (
  LEGACY_PROXY_ERROR_PATTERNS.some((pattern) => pattern.test(value))
);

const buildLegacyProxyErrorMessage = (config: OpenAIProxyConfig, rawMessage: string) => {
  const base = config.source === 'settings'
    ? 'Le proxy configuré dans Settings semble pointer vers un ancien backend.'
    : 'Le proxy IA semble pointer vers un backend obsolète.';
  const fallback = config.envUrl
    ? 'Le client peut utiliser VITE_OPENAI_PROXY_URL en secours si vous videz l’override Settings.'
    : 'Définissez VITE_OPENAI_PROXY_URL ou videz l’override Settings > Assistant IA.';
  return `${base} ${fallback} Détail: ${rawMessage}`;
};

const shouldRetryWithEnvFallback = (
  config: OpenAIProxyConfig,
  status: number | null,
  rawMessage: string
) => (
  config.source === 'settings'
  && Boolean(config.envUrl)
  && config.envUrl !== config.overrideUrl
  && status !== null
  && [400, 401, 403].includes(status)
  && isLegacyProxyAuthError(rawMessage)
);

const normalizeProxyPayload = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') return payload;
  const record = payload as { sections?: unknown };
  if (!Array.isArray(record.sections)) return payload;

  const mapped: Record<string, string> = {};
  record.sections.forEach((section) => {
    const sectionRecord = section as { title?: unknown; content?: unknown };
    if (!sectionRecord || typeof sectionRecord.content !== 'string') return;
    const key = mapSectionTitleToKey(typeof sectionRecord.title === 'string' ? sectionRecord.title : '');
    if (key) {
      mapped[key] = sectionRecord.content;
    }
  });

  return Object.keys(mapped).length > 0 ? mapped : payload;
};

const normalizeProxyResult = (payload: unknown, type: 'group' | 'column' | 'site' | 'communication') => {
  if (type !== 'group') {
    return typeof payload === 'string' ? payload : JSON.stringify(payload);
  }

  if (typeof payload === 'string') {
    const parsed = parseJsonSafely(payload.trim());
    if (!parsed) return payload;
    return JSON.stringify(normalizeProxyPayload(parsed));
  }

  return JSON.stringify(normalizeProxyPayload(payload));
};

export const getOpenAIProxyConfig = (options?: { overrideUrl?: string | null }): OpenAIProxyConfig => {
  const envUrl = trimToNull(import.meta.env.VITE_OPENAI_PROXY_URL);
  const settingsUrl = trimToNull(
    typeof options?.overrideUrl === 'string' ? options.overrideUrl : readAppSettings().openaiProxyUrlOverride
  );
  const url = settingsUrl ?? envUrl;
  return {
    envUrl,
    overrideUrl: settingsUrl,
    url,
    source: settingsUrl ? 'settings' : envUrl ? 'env' : 'missing'
  };
};

const buildProxyHeaders = async () => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  let hasAuthToken = false;
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session?.access_token) {
      headers.Authorization = `Bearer ${sessionData.session.access_token}`;
      hasAuthToken = true;
    }
  }
  return { headers, hasAuthToken };
};

export const checkOpenAIProxyHealth = async (options?: { overrideUrl?: string | null }): Promise<OpenAIProxyHealth> => {
  const config = getOpenAIProxyConfig(options);
  if (!config.url) {
    return {
      ok: false,
      reachable: false,
      url: null,
      source: 'missing',
      status: null,
      statusText: null,
      hasAuthToken: false,
      message: 'URL du proxy IA absente. Définissez VITE_OPENAI_PROXY_URL ou configurez-la dans Settings.'
    };
  }

  try {
    const { headers, hasAuthToken } = await buildProxyHeaders();
    const attempt = async (url: string) => {
      const response = await fetch(deriveHealthUrl(url), {
        method: 'GET',
        headers,
        cache: 'no-store'
      });
      const rawText = await response.text();
      const payload = parseJsonSafely(rawText) ?? rawText;
      const payloadMessage = isRecord(payload) && typeof payload.message === 'string'
        ? payload.message
        : typeof payload === 'string' && payload.trim()
          ? payload.trim().slice(0, 240)
          : null;
      return { response, rawText, payload, payloadMessage };
    };

    let activeUrl = config.url;
    let source = config.source;
    let { response, rawText, payload, payloadMessage } = await attempt(activeUrl);

    if (!response.ok && shouldRetryWithEnvFallback(config, response.status, rawText) && config.envUrl) {
      activeUrl = config.envUrl;
      source = 'env';
      ({ response, rawText, payload, payloadMessage } = await attempt(activeUrl));
    }

    const message = response.ok
      ? payloadMessage || 'Proxy joignable.'
      : isLegacyProxyAuthError(rawText)
        ? buildLegacyProxyErrorMessage(config, payloadMessage || rawText)
        : payloadMessage || `Le proxy répond avec le statut ${response.status}.`;

    return {
      ok: response.ok,
      reachable: true,
      url: activeUrl,
      source,
      status: response.status,
      statusText: response.statusText,
      hasAuthToken,
      message,
      payload
    };
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : 'Échec réseau lors de la vérification du proxy.';
    return {
      ok: false,
      reachable: false,
      url: config.url,
      source: config.source,
      status: null,
      statusText: null,
      hasAuthToken: false,
      message
    };
  }
};

const buildEnrichedSituation = (
  situation: string,
  opts?: {
    dominante?: string;
    secondaryRisks?: string[];
    extraContext?: string;
  }
) => {
  const extraLines: string[] = [];
  if (opts?.secondaryRisks?.length) {
    extraLines.push(`Risques secondaires: ${opts.secondaryRisks.join(', ')}`);
  }
  if (opts?.extraContext) {
    extraLines.push(`Contexte complémentaire: ${opts.extraContext}`);
  }
  if (!extraLines.length) return situation;
  return `${situation}\n\n${extraLines.join('\n')}`.trim();
};

export const analyzeEmergency = async (
  situation: string,
  type: 'group' | 'column' | 'site' | 'communication',
  opts?: {
    dominante?: string;
    secondaryRisks?: string[];
    extraContext?: string;
    sections?: Record<string, string>;
  }
) => {
  try {
    const proxyConfig = getOpenAIProxyConfig();
    const enrichedSituation = buildEnrichedSituation(situation, opts);
    const requestSituation = type === 'group' ? situation : enrichedSituation;

    if (!proxyConfig.url) {
      throw new Error('URL du proxy IA absente. Définissez VITE_OPENAI_PROXY_URL ou configurez-la dans Settings > Assistant IA.');
    }

    const { headers } = await buildProxyHeaders();

    const payload: Record<string, unknown> = {
      type,
      situation: requestSituation,
      dominante: opts?.dominante,
      secondaryRisks: opts?.secondaryRisks,
      extraContext: opts?.extraContext,
      sections: opts?.sections
    };

    const attempt = async (url: string) => {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      const rawText = await response.text();
      return { response, rawText };
    };

    let { response, rawText } = await attempt(proxyConfig.url);
    if (!response.ok && shouldRetryWithEnvFallback(proxyConfig, response.status, rawText) && proxyConfig.envUrl) {
      ({ response, rawText } = await attempt(proxyConfig.envUrl));
    }

    if (!response.ok) {
      const detail = isLegacyProxyAuthError(rawText)
        ? buildLegacyProxyErrorMessage(proxyConfig, rawText)
        : rawText;
      throw new Error(`Erreur proxy IA: ${response.status} ${response.statusText} - ${detail}`);
    }

    const data = parseJsonSafely(rawText);
    const resultPayload = isRecord(data)
      ? data.result ?? data.output ?? data.content ?? data
      : data ?? rawText;
    return normalizeProxyResult(resultPayload, type);

  } catch (error) {
    console.error('Error analyzing emergency:', error);
    const message = error instanceof Error ? error.message : 'Erreur lors de l\'analyse de la situation d\'urgence.';
    throw new Error(message);
  }
};
