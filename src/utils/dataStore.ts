import { readUserScopedJSON, writeUserScopedJSON } from './userStorage';

export interface DictationData {
  type: 'group' | 'column' | 'site';
  situation: string;
  objectifs: string;
  idees: string;
  execution: string;
  commandement: string;
  anticipation?: string;
  logistique?: string;
  groupe_horaire: Date;
  dominante?: string;
  adresse?: string;
  heure_ordre?: string;
  message_ambiance?: Record<string, unknown>;
  message_compte_rendu?: Record<string, unknown>;
}

export interface CommunicationData {
  groupe_horaire: Date;
  Engagement_secours: string;
  Situation_appel: string;
  Situation_arrivee: string;
  Nombre_victimes: string;
  Moyens: string;
  Actions_secours: string;
  Conseils_population: string;
  dominante?: string;
  message_ambiance?: Record<string, unknown>;
  message_compte_rendu?: Record<string, unknown>;
}

export interface CommunicationIAData {
  input: string;
  groupe_horaire: Date;
  Engagement_secours: string;
  Situation_appel: string;
  Situation_arrivee: string;
  Nombre_victimes: string;
  Moyens: string;
  Actions_secours: string;
  Conseils_population: string;
  dominante?: string;
  message_ambiance?: Record<string, unknown>;
  message_compte_rendu?: Record<string, unknown>;
}

export type InterventionSharePayload = {
  version: 1;
  shareType?: 'group' | 'column' | 'site' | 'communication';
  draft: Record<string, unknown>;
  octTree?: unknown;
  sitacState?: Record<string, unknown>;
  interventionMeta?: Record<string, unknown>;
};

type StoredEntry<T> = {
  id: string;
  created_at: string;
  payload: T;
};

const STORAGE_KEYS = {
  dictation: 'atlas-dictation-saves',
  communication: 'atlas-communication-saves',
  communicationIA: 'atlas-communication-ia-saves',
  interventionShares: 'atlas-intervention-shares'
} as const;

const createId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const readEntries = <T>(key: string): StoredEntry<T>[] => {
  try {
    const parsed = readUserScopedJSON<StoredEntry<T>[]>(key, 'local');
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Storage read error', err);
    return [];
  }
};

const writeEntries = <T>(key: string, entries: StoredEntry<T>[]) => {
  try {
    writeUserScopedJSON(key, entries, 'local');
  } catch (err) {
    console.error('Storage write error', err);
  }
};

const readShareMap = (): Record<string, StoredEntry<InterventionSharePayload>> => {
  try {
    const parsed = readUserScopedJSON<Record<string, StoredEntry<InterventionSharePayload>>>(
      STORAGE_KEYS.interventionShares,
      'local'
    );
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    console.error('Share read error', err);
    return {};
  }
};

const writeShareMap = (map: Record<string, StoredEntry<InterventionSharePayload>>) => {
  try {
    writeUserScopedJSON(STORAGE_KEYS.interventionShares, map, 'local');
  } catch (err) {
    console.error('Share write error', err);
  }
};

const saveEntry = async <T>(key: string, data: T) => {
  const id = createId();
  const entry: StoredEntry<T> = {
    id,
    created_at: new Date().toISOString(),
    payload: data
  };
  const entries = readEntries<T>(key);
  entries.push(entry);
  writeEntries(key, entries);
  return id;
};

export const saveDictationData = async (data: DictationData) =>
  saveEntry<DictationData>(STORAGE_KEYS.dictation, data);

export const saveCommunicationData = async (data: CommunicationData) =>
  saveEntry<CommunicationData>(STORAGE_KEYS.communication, data);

export const saveCommunicationIAData = async (data: CommunicationIAData) =>
  saveEntry<CommunicationIAData>(STORAGE_KEYS.communicationIA, data);

export const saveInterventionShare = async (payload: InterventionSharePayload) => {
  const id = createId();
  const entry: StoredEntry<InterventionSharePayload> = {
    id,
    created_at: new Date().toISOString(),
    payload
  };
  const map = readShareMap();
  map[id] = entry;
  writeShareMap(map);
  return id;
};

export const getInterventionShare = async (shareId: string): Promise<InterventionSharePayload | null> => {
  const map = readShareMap();
  return map[shareId]?.payload ?? null;
};
