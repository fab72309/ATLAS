import { useEffect, useState } from 'react';
import { OctNodeType } from './octTreeStore';

export const MEANS_CATEGORY_KEYS = ['incendie', 'suap', 'speciaux', 'commandement'] as const;
export type MeansCategoryKey = typeof MEANS_CATEGORY_KEYS[number];

export const OCT_LABEL_KEYS = ['cdt', 'ope1', 'ope2', 'tact12', 'tact34', 'airSol', 'crm'] as const;
export type OctLabelKey = typeof OCT_LABEL_KEYS[number];

const OCT_LABEL_SLOTS: Record<OctLabelKey, number> = {
  cdt: 1,
  ope1: 1,
  ope2: 1,
  tact12: 4,
  tact34: 4,
  airSol: 1,
  crm: 1
};

export type MeanCatalogItem = {
  id: string;
  name: string;
  category: MeansCategoryKey;
};

export type OctFrequencyDefaults = Record<OctNodeType, { up: string; down: string }>;
export type OctLabelDefaults = Record<OctLabelKey, string[]>;
export type MessageCheckboxOption = { id: string; label: string };

export type SessionSettings = {
  meansCatalog: MeanCatalogItem[];
  octDefaults: OctFrequencyDefaults;
  octLabelDefaults: OctLabelDefaults;
  messageDemandeOptions: MessageCheckboxOption[];
  messageSurLesLieuxOptions: MessageCheckboxOption[];
};

const STORAGE_KEY = 'atlas-session-settings';
const UPDATE_EVENT = 'atlas-session-settings:update';

const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `mean-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const getDefaultOctDefaults = (): OctFrequencyDefaults => ({
  codis: { up: '218', down: '270' },
  cos: { up: '230', down: '' },
  sector: { up: '', down: '' },
  subsector: { up: '', down: '' },
  engine: { up: '', down: '' }
});

export const getDefaultOctLabelDefaults = (): OctLabelDefaults => {
  const defaults = {} as OctLabelDefaults;
  OCT_LABEL_KEYS.forEach((key) => {
    defaults[key] = Array.from({ length: OCT_LABEL_SLOTS[key] }, () => '');
  });
  return defaults;
};

export const getDefaultMessageDemandeOptions = (): MessageCheckboxOption[] => ([
  { id: 'equipeMedicale', label: 'Équipe médicale' },
  { id: 'enedis', label: 'ENEDIS' },
  { id: 'grdf', label: 'GRDF' },
  { id: 'sceEaux', label: 'Sce des eaux' },
  { id: 'servicesTechniques', label: 'Services techniques' },
  { id: 'forcesOrdre', label: "Forces de l'ordre" },
  { id: 'steAutoroute', label: 'Ste autoroute' },
  { id: 'dde', label: 'DDE' },
  { id: 'cil', label: 'CIL' },
  { id: 'eluPermanence', label: 'Élu permanence' }
]);

export const getDefaultMessageSurLesLieuxOptions = (): MessageCheckboxOption[] => ([
  { id: 'secoursSllSuffisants', label: 'Secours SLL suffisants' },
  { id: 'feuCirconscrit', label: 'Feu circonscrit' },
  { id: 'maitreDuFeu', label: 'Maître du feu' },
  { id: 'feuEteint', label: 'Feu éteint' },
  { id: 'reconnaissanceEnCours', label: 'Reconnaissance en cours' },
  { id: 'poursuivonsReconnaissance', label: 'Poursuivons reconnaissance' },
  { id: 'deblaiEnCours', label: 'Déblai en cours' }
]);

const getDefaultSettings = (): SessionSettings => ({
  meansCatalog: [],
  octDefaults: getDefaultOctDefaults(),
  octLabelDefaults: getDefaultOctLabelDefaults(),
  messageDemandeOptions: getDefaultMessageDemandeOptions(),
  messageSurLesLieuxOptions: getDefaultMessageSurLesLieuxOptions()
});

const sanitizeMeansCatalog = (input: unknown): MeanCatalogItem[] => {
  if (!Array.isArray(input)) return [];
  return input
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const item = entry as Partial<MeanCatalogItem>;
      const name = typeof item.name === 'string' ? item.name.trim() : '';
      const category = MEANS_CATEGORY_KEYS.includes(item.category as MeansCategoryKey)
        ? (item.category as MeansCategoryKey)
        : null;
      if (!name || !category) return null;
      const id = typeof item.id === 'string' && item.id ? item.id : generateId();
      return { id, name, category };
    })
    .filter((item): item is MeanCatalogItem => Boolean(item));
};

const sanitizeOctDefaults = (input: unknown): OctFrequencyDefaults => {
  const defaults = getDefaultOctDefaults();
  if (!input || typeof input !== 'object') return defaults;
  const typed = input as Partial<OctFrequencyDefaults>;
  const types: OctNodeType[] = ['codis', 'cos', 'sector', 'subsector', 'engine'];
  types.forEach((type) => {
    const entry = typed[type];
    if (!entry || typeof entry !== 'object') return;
    const up = typeof entry.up === 'string' ? entry.up : defaults[type].up;
    const down = typeof entry.down === 'string' ? entry.down : defaults[type].down;
    defaults[type] = { up, down };
  });
  return defaults;
};

const sanitizeOctLabelDefaults = (input: unknown): OctLabelDefaults => {
  const defaults = getDefaultOctLabelDefaults();
  if (!input || typeof input !== 'object') return defaults;
  const typed = input as Partial<OctLabelDefaults>;
  OCT_LABEL_KEYS.forEach((key) => {
    const slots = OCT_LABEL_SLOTS[key];
    const raw = typed[key];
    if (!Array.isArray(raw)) return;
    const cleaned = raw.map((value) => (typeof value === 'string' ? value : '')).slice(0, slots);
    while (cleaned.length < slots) cleaned.push('');
    defaults[key] = cleaned;
  });
  return defaults;
};

const sanitizeMessageOptions = (input: unknown, fallback: MessageCheckboxOption[]): MessageCheckboxOption[] => {
  if (!Array.isArray(input)) return fallback;
  const seen = new Set<string>();
  return input
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const item = entry as Partial<MessageCheckboxOption>;
      const id = typeof item.id === 'string' ? item.id.trim() : '';
      const label = typeof item.label === 'string' ? item.label.trim() : '';
      if (!id || !label || seen.has(id)) return null;
      seen.add(id);
      return { id, label };
    })
    .filter((item): item is MessageCheckboxOption => Boolean(item));
};

export const readSessionSettings = (): SessionSettings => {
  if (typeof window === 'undefined') return getDefaultSettings();
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SessionSettings>;
      const defaultDemandeOptions = getDefaultMessageDemandeOptions();
      const defaultSurLesLieuxOptions = getDefaultMessageSurLesLieuxOptions();
      return {
        meansCatalog: sanitizeMeansCatalog(parsed.meansCatalog),
        octDefaults: sanitizeOctDefaults(parsed.octDefaults),
        octLabelDefaults: sanitizeOctLabelDefaults(parsed.octLabelDefaults),
        messageDemandeOptions: sanitizeMessageOptions(parsed.messageDemandeOptions, defaultDemandeOptions),
        messageSurLesLieuxOptions: sanitizeMessageOptions(parsed.messageSurLesLieuxOptions, defaultSurLesLieuxOptions)
      };
    }
  } catch (err) {
    console.error('Session settings read error', err);
  }
  return getDefaultSettings();
};

export const writeSessionSettings = (settings: SessionSettings) => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new Event(UPDATE_EVENT));
  } catch (err) {
    console.error('Session settings write error', err);
  }
};

export const updateSessionSettings = (updater: (prev: SessionSettings) => SessionSettings) => {
  const next = updater(readSessionSettings());
  writeSessionSettings(next);
  return next;
};

export const useSessionSettings = () => {
  const [settings, setSettings] = useState<SessionSettings>(() => readSessionSettings());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => setSettings(readSessionSettings());
    window.addEventListener(UPDATE_EVENT, handler);
    return () => window.removeEventListener(UPDATE_EVENT, handler);
  }, []);

  const setAndStore = (next: SessionSettings) => {
    writeSessionSettings(next);
    setSettings(next);
  };

  const updateSettings = (updater: (prev: SessionSettings) => SessionSettings) => {
    const next = updateSessionSettings(updater);
    setSettings(next);
  };

  return { settings, setSettings: setAndStore, updateSettings };
};
