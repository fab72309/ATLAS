import { getSupabaseClient } from './supabaseClient';
import { DOCTRINE_CONTEXT } from '../constants/doctrine';

const DOCTRINE_DOMINANTE_MAP: Record<string, keyof typeof DOCTRINE_CONTEXT> = {
  Incendie: 'incendie_structure',
  'Risque Gaz': 'fuite_gaz',
  'Accident de circulation': 'secours_routier',
  SMV: 'secours_personne_complexe',
  SUAP: 'secours_personne_complexe',
  NRBC: 'secours_personne_complexe',
  'Risque Chimique': 'fuite_gaz',
  'Risque Radiologique': 'secours_personne_complexe',
  'Feux de végétation': 'incendie_vegetation',
  'Incendie de végétation': 'incendie_vegetation',
};

const getDoctrineContext = (dominante?: string) => {
  if (!dominante) return null;
  const key = DOCTRINE_DOMINANTE_MAP[dominante];
  return key ? DOCTRINE_CONTEXT[key] : null;
};

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
    const proxyUrl = import.meta.env.VITE_OPENAI_PROXY_URL?.trim();
    const enrichedSituation = buildEnrichedSituation(situation, opts);
    const requestSituation = type === 'group' ? situation : enrichedSituation;
    const doctrineContext = type === 'group' ? getDoctrineContext(opts?.dominante) : null;

    if (!proxyUrl) {
      throw new Error('VITE_OPENAI_PROXY_URL manquante. L\'app doit passer par un proxy serveur pour protéger la clé.');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session?.access_token) {
        headers.Authorization = `Bearer ${sessionData.session.access_token}`;
      }
    }

    const payload: Record<string, unknown> = {
      type,
      situation: requestSituation,
      dominante: opts?.dominante,
      secondaryRisks: opts?.secondaryRisks,
      extraContext: opts?.extraContext,
      sections: opts?.sections
    };
    if (doctrineContext) {
      payload.doctrine_context = doctrineContext;
    }

    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erreur proxy IA: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const rawText = await response.text();
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
