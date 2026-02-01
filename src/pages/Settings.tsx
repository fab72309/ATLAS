import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Info, Bell, Shield, LogOut, Sun, Plus, Trash2, User, History } from 'lucide-react';
import { RELEASE_NOTES } from '../constants/releaseNotes';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';
import { APP_NAME, APP_VERSION } from '../constants/appInfo';
import ThemeSelector from '../components/ThemeSelector';
import { useTheme } from '../contexts/ThemeContext';
import { DOCTRINE_CONTEXT } from '../constants/doctrine';
import {
  EMPLOYMENT_LEVEL_OPTIONS,
  normalizeEmploymentLevel,
  SHORTCUT_OPTIONS,
  type EmploymentLevel,
  type ShortcutKey
} from '../constants/profile';
import {
  getDefaultMessageDemandeOptions,
  getDefaultMessageSurLesLieuxOptions,
  getDefaultOctDefaults,
  getDefaultOctLabelDefaults,
  MeansCategoryKey,
  type MessageCheckboxOption,
  OctFrequencyDefaults,
  OctLabelDefaults,
  OctLabelKey,
  useSessionSettings
} from '../utils/sessionSettings';
import { OctTreeNode, createInitialOctTree, setOctTree } from '../utils/octTreeStore';
import { getSupabaseClient } from '../utils/supabaseClient';
import { normalizeMeanItems } from '../utils/means';
import { isOctTreeNode, parseConduitePayload, parseOiPayload } from '../utils/interventionHydration';
import { normalizeSymbolProps } from '../utils/sitacSymbolPersistence';
import { getSimpleSectionContentList, getSimpleSectionText } from '../utils/soiec';
import type { MeanItem } from '../types/means';
import type { OrdreInitial } from '../types/soiec';
import type { HydratedOrdreConduite, HydratedOrdreInitial, InterventionHistoryEntry } from '../stores/useInterventionStore';

const MEANS_CATEGORIES: Array<{ key: MeansCategoryKey; label: string; doctrineKey: keyof typeof DOCTRINE_CONTEXT }> = [
  { key: 'incendie', label: 'Incendie', doctrineKey: 'incendie_structure' },
  { key: 'suap', label: 'SUAP', doctrineKey: 'secours_personne_complexe' },
  { key: 'speciaux', label: 'Engins spéciaux', doctrineKey: 'fuite_gaz' },
  { key: 'commandement', label: 'Commandement', doctrineKey: 'secours_personne_complexe' }
];

const OCT_LABEL_OPTIONS: Array<{ key: OctLabelKey; label: string; slots: number }> = [
  { key: 'cdt', label: 'CDT', slots: 1 },
  { key: 'ope1', label: 'OPE 1', slots: 1 },
  { key: 'ope2', label: 'OPE 2', slots: 1 },
  { key: 'tact12', label: 'TACT 1/2', slots: 4 },
  { key: 'tact34', label: 'TACT 3/4', slots: 4 },
  { key: 'airSol', label: 'AIR/SOL', slots: 1 },
  { key: 'crm', label: 'CRM', slots: 1 }
];

type InterventionHistoryItem = {
  id: string;
  status: string;
  title: string | null;
  created_at: string | null;
  updated_at: string | null;
  address_line1: string | null;
  street_number: string | null;
  street_name: string | null;
  city: string | null;
  incident_number: string | null;
  command_level: string | null;
  role: string | null;
};

type InterventionHistoryDetails = {
  ordreInitialHistory: InterventionHistoryEntry<HydratedOrdreInitial>[];
  ordreConduiteHistory: InterventionHistoryEntry<HydratedOrdreConduite>[];
  means: MeanItem[];
  messages: MessageHistoryEntry[];
  sitacFeatures: SitacHistoryFeature[];
  sitacCount: number;
  octCounts: { total: number; sectors: number; subsectors: number; engines: number } | null;
};

type SitacHistoryRow = {
  feature_id: string;
  symbol_type: string;
  lat: number;
  lng: number;
  props: Record<string, unknown> | null;
};

type SitacHistoryFeature = {
  id: string;
  symbolType: string;
  color: string;
  label: string;
  lat: number;
  lng: number;
};

type MessagePayload = {
  date?: string;
  time?: string;
  stamped?: boolean;
  addressConfirmed?: boolean;
  jeSuis?: string;
  jeVois?: string;
  jeDemande?: string;
  jePrevois?: string;
  jeFais?: string;
  demandes?: Record<string, unknown>;
  surLesLieux?: Record<string, unknown>;
};

type MessageHistoryEntry = {
  id: string;
  createdAt: string;
  type: 'MESSAGE_AMBIANCE_VALIDATED' | 'MESSAGE_COMPTE_RENDU_VALIDATED';
  payload: MessagePayload;
};

const FEU_ETEINT_ID = 'feuEteint';
const MOYENS_SP_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'moyensSpFpt', label: 'FPT' },
  { key: 'moyensSpEpc', label: 'EPC' },
  { key: 'moyensSpVsav', label: 'VSAV' },
  { key: 'moyensSpCcf', label: 'CCF' },
  { key: 'moyensSpVsr', label: 'VSR' }
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const formatInterventionDate = (value: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const buildAddressLine = (item: InterventionHistoryItem) => (
  item.address_line1?.trim()
  || [item.street_number, item.street_name].filter(Boolean).join(' ').trim()
);

const buildCityLine = (item: InterventionHistoryItem) => item.city?.trim();

const parseMessagePayload = (payload: unknown): MessagePayload | null => {
  if (!payload || typeof payload !== 'object') return null;
  const data = (payload as { data?: unknown }).data;
  if (!data || typeof data !== 'object') return null;
  return data as MessagePayload;
};

const normalizeSelections = (input: unknown): Record<string, boolean> => {
  if (!input || typeof input !== 'object') return {};
  const record = input as Record<string, unknown>;
  return Object.keys(record).reduce<Record<string, boolean>>((acc, key) => {
    if (typeof record[key] === 'boolean') acc[key] = Boolean(record[key]);
    return acc;
  }, {});
};

const readStringField = (record: Record<string, unknown>, key: string) =>
  typeof record[key] === 'string' ? record[key].trim() : '';

const buildDemandesSummary = (payload: MessagePayload, options: MessageCheckboxOption[]) => {
  if (!payload?.demandes || !isRecord(payload.demandes)) return [];
  const record = payload.demandes;
  const selections = record.selections && typeof record.selections === 'object'
    ? normalizeSelections(record.selections)
    : normalizeSelections(record);
  const selected = options.filter((opt) => selections[opt.id]).map((opt) => opt.label);
  const moyensSp = MOYENS_SP_FIELDS
    .map(({ key, label }) => {
      const value = readStringField(record, key);
      return value ? `${label} ${value}` : '';
    })
    .filter(Boolean)
    .join(', ');
  if (moyensSp) selected.push(`Moyens SP: ${moyensSp}`);
  const autresMoyensSp = readStringField(record, 'autresMoyensSp');
  if (autresMoyensSp) selected.push(`Autres moyens SP: ${autresMoyensSp}`);
  const autres = readStringField(record, 'autres');
  if (autres) selected.push(`Autre(s): ${autres}`);
  return selected;
};

const buildSurLesLieuxSummary = (payload: MessagePayload, options: MessageCheckboxOption[]) => {
  if (!payload?.surLesLieux || !isRecord(payload.surLesLieux)) return [];
  const record = payload.surLesLieux;
  const selections = record.selections && typeof record.selections === 'object'
    ? normalizeSelections(record.selections)
    : normalizeSelections(record);
  const selected = options
    .filter((opt) => opt.id !== FEU_ETEINT_ID && selections[opt.id])
    .map((opt) => opt.label);
  const feuEteintOption = options.find((opt) => opt.id === FEU_ETEINT_ID);
  if (feuEteintOption && selections[FEU_ETEINT_ID]) {
    const timeLabel = readStringField(record, 'feuEteintHeure');
    selected.push(timeLabel ? `${feuEteintOption.label} ${timeLabel}` : feuEteintOption.label);
  }
  return selected;
};

const buildSitacHistoryFeature = (row: SitacHistoryRow): SitacHistoryFeature => {
  const baseProps = row.props ?? {};
  const symbolTypeRaw = typeof row.symbol_type === 'string' ? row.symbol_type : 'symbol';
  const { type: symbolType, props } = normalizeSymbolProps(symbolTypeRaw, baseProps);
  const color = typeof (props as Record<string, unknown>).color === 'string'
    ? (props as Record<string, unknown>).color as string
    : '#3b82f6';
  const textContent = typeof (props as Record<string, unknown>).textContent === 'string'
    ? (props as Record<string, unknown>).textContent as string
    : '';
  const iconName = typeof (props as Record<string, unknown>).iconName === 'string'
    ? (props as Record<string, unknown>).iconName as string
    : '';
  const label = textContent || iconName || symbolType;
  return {
    id: row.feature_id,
    symbolType,
    color,
    label,
    lat: row.lat,
    lng: row.lng
  };
};

const countOctNodes = (node: OctTreeNode, acc = { total: 0, sectors: 0, subsectors: 0, engines: 0 }) => {
  acc.total += 1;
  if (node.type === 'sector') acc.sectors += 1;
  if (node.type === 'subsector') acc.subsectors += 1;
  if (node.type === 'engine') acc.engines += 1;
  node.children.forEach((child) => countOctNodes(child, acc));
  return acc;
};

const formatHistoryTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const formatList = (items: OrdreInitial['O'] | OrdreInitial['A'] | OrdreInitial['L'] | undefined) => {
  const normalized = getSimpleSectionContentList(items);
  if (normalized.length === 0) return '-';
  return normalized.map((item, index) => `${index + 1}. ${item}`).join('\n');
};

const formatIdeeManoeuvre = (items: OrdreInitial['I']) => {
  if (!Array.isArray(items) || items.length === 0) return '-';
  const filtered = items.filter((idea) => idea?.type !== 'separator' && idea?.type !== 'empty');
  if (filtered.length === 0) return '-';
  return filtered
    .map((idea, index) => {
      if (!idea) return `${index + 1}. -`;
      const mission = idea.mission || '';
      const moyen = idea.moyen ? ` (${idea.moyen})` : '';
      const moyenSupp = idea.moyen_supp ? ` + ${idea.moyen_supp}` : '';
      const details = idea.details ? ` — ${idea.details}` : '';
      return `${index + 1}. ${mission}${moyen}${moyenSupp}${details}`.trim();
    })
    .join('\n');
};

const formatExecution = (value: OrdreInitial['E']) => {
  if (!value) return '-';
  if (Array.isArray(value)) {
    const filtered = value.filter((entry) => {
      if (!entry || typeof entry !== 'object') return true;
      const record = entry as unknown as Record<string, unknown>;
      return record.type !== 'separator' && record.type !== 'empty';
    });
    if (filtered.length === 0) return '-';
    return filtered
      .map((entry, index) => {
        if (typeof entry === 'string') return `${index + 1}. ${entry}`;
        if (entry && typeof entry === 'object') {
          const record = entry as unknown as Record<string, unknown>;
          const title = typeof record.title === 'string' ? record.title : '';
          const mission = typeof record.mission === 'string' ? record.mission : '';
          const observation = typeof record.observation === 'string' ? record.observation : '';
          const details = [title || mission, observation].filter(Boolean).join(' — ');
          return `${index + 1}. ${details || '-'}`;
        }
        return `${index + 1}. -`;
      })
      .join('\n');
  }
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
};

const createMeanId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `mean-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const createMessageOptionId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `message-option-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const buildDefaultMeansCatalog = () => {
  const entries: Array<{ id: string; name: string; category: MeansCategoryKey }> = [];
  const seen = new Set<string>();
  MEANS_CATEGORIES.forEach((cat) => {
    const ctx = DOCTRINE_CONTEXT[cat.doctrineKey];
    const moyens = ctx?.moyens_standards_td || [];
    moyens.forEach((m: string) => {
      const title = m.split(':')[0].trim();
      if (!title) return;
      const key = `${cat.key}:${title}`;
      if (seen.has(key)) return;
      seen.add(key);
      entries.push({ id: createMeanId(), name: title, category: cat.key });
    });
  });
  return entries;
};

const normalizeFrequencyValues = (values?: string[]) =>
  (values ?? []).map((value) => value.trim()).filter(Boolean);

const normalizeFrequencyPair = (pair?: { up: string; down: string }) =>
  normalizeFrequencyValues([pair?.up ?? '', pair?.down ?? '']);

const areFrequencyListsEqual = (a: string[], b: string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

const normalizeLabel = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const OCT_LABEL_LOOKUP = new Map<string, OctLabelKey>([
  ['cdt', 'cdt'],
  ['codis', 'cdt'],
  ['ope1', 'ope1'],
  ['ope2', 'ope2'],
  ['secteur1', 'ope1'],
  ['secteur01', 'ope1'],
  ['secteur2', 'ope2'],
  ['secteur02', 'ope2'],
  ['tact12', 'tact12'],
  ['tact34', 'tact34'],
  ['airsol', 'airSol'],
  ['crm', 'crm']
]);

const getLabelKeyForNode = (label?: string): OctLabelKey | null => {
  if (!label) return null;
  const normalized = normalizeLabel(label);
  return OCT_LABEL_LOOKUP.get(normalized) || null;
};

const getBaseLabelDefaultsFromTree = () => {
  const defaults = getDefaultOctLabelDefaults();
  const baseTree = createInitialOctTree();
  const visit = (node: OctTreeNode) => {
    const labelKey = getLabelKeyForNode(node.label);
    const frequencies = normalizeFrequencyValues(node.frequencies);
    if (labelKey && frequencies.length > 0) {
      defaults[labelKey] = frequencies;
    }
    node.children.forEach(visit);
  };
  visit(baseTree);
  return defaults;
};

const applyOctDefaultsToTree = (
  tree: OctTreeNode,
  previousTypeDefaults: OctFrequencyDefaults,
  nextTypeDefaults: OctFrequencyDefaults,
  previousLabelDefaults: OctLabelDefaults,
  nextLabelDefaults: OctLabelDefaults
): OctTreeNode => {
  const baseTypeDefaults = getDefaultOctDefaults();
  const baseLabelDefaults = getBaseLabelDefaultsFromTree();
  const updateNode = (node: OctTreeNode): OctTreeNode => {
    const current = normalizeFrequencyValues(node.frequencies);
    const prevTypeList = normalizeFrequencyPair(previousTypeDefaults[node.type]);
    const baseTypeList = normalizeFrequencyPair(baseTypeDefaults[node.type]);
    const nextTypeList = normalizeFrequencyPair(nextTypeDefaults[node.type]);
    const shouldUpdateType =
      current.length === 0 ||
      areFrequencyListsEqual(current, prevTypeList) ||
      areFrequencyListsEqual(current, baseTypeList);
    let nextFrequencies = shouldUpdateType ? nextTypeList : node.frequencies;

    const labelKey = getLabelKeyForNode(node.label);
    if (labelKey) {
      const prevLabelList = normalizeFrequencyValues(previousLabelDefaults[labelKey]);
      const baseLabelList = normalizeFrequencyValues(baseLabelDefaults[labelKey]);
      const nextLabelList = normalizeFrequencyValues(nextLabelDefaults[labelKey]);
      const shouldUpdateLabel =
        current.length === 0 ||
        areFrequencyListsEqual(current, prevLabelList) ||
        areFrequencyListsEqual(current, baseLabelList) ||
        areFrequencyListsEqual(current, prevTypeList) ||
        areFrequencyListsEqual(current, baseTypeList);
      if (shouldUpdateLabel) {
        nextFrequencies = nextLabelList;
      }
    }

    return {
      ...node,
      frequencies: nextFrequencies,
      children: node.children.map(updateNode)
    };
  };

  return updateNode(tree);
};

const Settings = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { profile, loading: profileLoading, error: profileError, updateProfile } = useProfile();
  const { theme, resolvedTheme } = useTheme();

  const { settings, updateSettings } = useSessionSettings();
  const [meanDraft, setMeanDraft] = useState<{ name: string; category: MeansCategoryKey }>({
    name: '',
    category: MEANS_CATEGORIES[0]?.key || 'incendie'
  });
  const [editingMeanId, setEditingMeanId] = useState<string | null>(null);
  const [octLabelDefaultsDraft, setOctLabelDefaultsDraft] = useState<OctLabelDefaults>(() => settings.octLabelDefaults);
  const [demandeDraft, setDemandeDraft] = useState({ label: '' });
  const [editingDemandeId, setEditingDemandeId] = useState<string | null>(null);
  const [surLesLieuxDraft, setSurLesLieuxDraft] = useState({ label: '' });
  const [editingSurLesLieuxId, setEditingSurLesLieuxId] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [profileDraft, setProfileDraft] = useState<{
    firstName: string;
    lastName: string;
    employmentLevel: EmploymentLevel | '';
    shortcutKeys: ShortcutKey[];
  }>({
    firstName: '',
    lastName: '',
    employmentLevel: '',
    shortcutKeys: []
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const profileSectionRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();
  const [historyItems, setHistoryItems] = useState<InterventionHistoryItem[]>([]);
  const [historyStatus, setHistoryStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historySelectedId, setHistorySelectedId] = useState<string | null>(null);
  const [historyDetail, setHistoryDetail] = useState<InterventionHistoryDetails | null>(null);
  const [historyDetailId, setHistoryDetailId] = useState<string | null>(null);
  const [historyDetailStatus, setHistoryDetailStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [historyDetailError, setHistoryDetailError] = useState<string | null>(null);
  const [historyDeleteId, setHistoryDeleteId] = useState<string | null>(null);
  const [historyDeleteError, setHistoryDeleteError] = useState<string | null>(null);

  const meansCatalog = useMemo(() => settings.meansCatalog || [], [settings.meansCatalog]);
  const messageDemandeOptions = settings.messageDemandeOptions || [];
  const messageSurLesLieuxOptions = settings.messageSurLesLieuxOptions || [];
  const sortedMeansCatalog = useMemo(() => {
    const order = MEANS_CATEGORIES.map((cat) => cat.key);
    return [...meansCatalog].sort((a, b) => {
      const aIndex = order.indexOf(a.category);
      const bIndex = order.indexOf(b.category);
      if (aIndex !== bIndex) return aIndex - bIndex;
      return a.name.localeCompare(b.name);
    });
  }, [meansCatalog]);

  const areOctDefaultsEqual = (a: OctLabelDefaults, b: OctLabelDefaults) =>
    OCT_LABEL_OPTIONS.every((entry) => {
      const aValues = a[entry.key] || [];
      const bValues = b[entry.key] || [];
      return areFrequencyListsEqual(
        aValues.map((value) => value.trim()),
        bValues.map((value) => value.trim())
      );
    });

  const isOctDefaultsDirty = useMemo(
    () => !areOctDefaultsEqual(octLabelDefaultsDraft, settings.octLabelDefaults),
    [octLabelDefaultsDraft, settings.octLabelDefaults]
  );

  const isProfileDirty = useMemo(() => {
    if (!profile) return false;
    const nextLevel = profileDraft.employmentLevel || null;
    const currentLevel = normalizeEmploymentLevel(profile.employment_level) || null;
    const nextShortcuts = profileDraft.shortcutKeys;
    const currentShortcuts = (profile.shortcut_keys || []) as ShortcutKey[];
    return (
      profileDraft.firstName.trim() !== (profile.first_name || '') ||
      profileDraft.lastName.trim() !== (profile.last_name || '') ||
      nextLevel !== currentLevel ||
      nextShortcuts.length !== currentShortcuts.length ||
      nextShortcuts.some((key, index) => key !== currentShortcuts[index])
    );
  }, [profile, profileDraft]);

  useEffect(() => {
    if (!profile) return;
    setProfileDraft({
      firstName: profile.first_name || '',
      lastName: profile.last_name || '',
      employmentLevel: normalizeEmploymentLevel(profile.employment_level) || '',
      shortcutKeys: (profile.shortcut_keys || []) as ShortcutKey[]
    });
    setProfileStatus(null);
  }, [profile]);

  useEffect(() => {
    if (!isOctDefaultsDirty) {
      setOctLabelDefaultsDraft(settings.octLabelDefaults);
    }
  }, [isOctDefaultsDirty, settings.octLabelDefaults]);

  const handleSaveMean = () => {
    const name = meanDraft.name.trim();
    if (!name) return;
    updateSettings((prev) => {
      const next = [...prev.meansCatalog];
      if (editingMeanId) {
        const idx = next.findIndex((item) => item.id === editingMeanId);
        if (idx >= 0) {
          next[idx] = { ...next[idx], name, category: meanDraft.category };
        }
      } else {
        next.push({ id: createMeanId(), name, category: meanDraft.category });
      }
      return { ...prev, meansCatalog: next };
    });
    setEditingMeanId(null);
    setMeanDraft((prev) => ({ ...prev, name: '' }));
  };

  const handleEditMean = (item: { id: string; name: string; category: MeansCategoryKey }) => {
    setEditingMeanId(item.id);
    setMeanDraft({ name: item.name, category: item.category });
  };

  const handleRemoveMean = (id: string) => {
    updateSettings((prev) => ({
      ...prev,
      meansCatalog: prev.meansCatalog.filter((item) => item.id !== id)
    }));
    if (editingMeanId === id) {
      setEditingMeanId(null);
      setMeanDraft((prev) => ({ ...prev, name: '' }));
    }
  };

  const handleLoadDefaultMeans = () => {
    const defaults = buildDefaultMeansCatalog();
    updateSettings((prev) => ({ ...prev, meansCatalog: defaults }));
    setEditingMeanId(null);
    setMeanDraft((prev) => ({ ...prev, name: '' }));
  };

  const handleClearMeans = () => {
    updateSettings((prev) => ({ ...prev, meansCatalog: [] }));
    setEditingMeanId(null);
    setMeanDraft((prev) => ({ ...prev, name: '' }));
  };

  const handleSaveDemandeOption = () => {
    const label = demandeDraft.label.trim();
    if (!label) return;
    updateSettings((prev) => {
      const next = [...prev.messageDemandeOptions];
      if (editingDemandeId) {
        const idx = next.findIndex((item) => item.id === editingDemandeId);
        if (idx >= 0) {
          next[idx] = { ...next[idx], label };
        }
      } else {
        next.push({ id: createMessageOptionId(), label });
      }
      return { ...prev, messageDemandeOptions: next };
    });
    setEditingDemandeId(null);
    setDemandeDraft({ label: '' });
  };

  const handleEditDemandeOption = (item: MessageCheckboxOption) => {
    setEditingDemandeId(item.id);
    setDemandeDraft({ label: item.label });
  };

  const handleRemoveDemandeOption = (id: string) => {
    updateSettings((prev) => ({
      ...prev,
      messageDemandeOptions: prev.messageDemandeOptions.filter((item) => item.id !== id)
    }));
    if (editingDemandeId === id) {
      setEditingDemandeId(null);
      setDemandeDraft({ label: '' });
    }
  };

  const handleResetDemandeOptions = () => {
    updateSettings((prev) => ({ ...prev, messageDemandeOptions: getDefaultMessageDemandeOptions() }));
    setEditingDemandeId(null);
    setDemandeDraft({ label: '' });
  };

  const handleSaveSurLesLieuxOption = () => {
    const label = surLesLieuxDraft.label.trim();
    if (!label) return;
    updateSettings((prev) => {
      const next = [...prev.messageSurLesLieuxOptions];
      if (editingSurLesLieuxId) {
        const idx = next.findIndex((item) => item.id === editingSurLesLieuxId);
        if (idx >= 0) {
          next[idx] = { ...next[idx], label };
        }
      } else {
        next.push({ id: createMessageOptionId(), label });
      }
      return { ...prev, messageSurLesLieuxOptions: next };
    });
    setEditingSurLesLieuxId(null);
    setSurLesLieuxDraft({ label: '' });
  };

  const handleEditSurLesLieuxOption = (item: MessageCheckboxOption) => {
    setEditingSurLesLieuxId(item.id);
    setSurLesLieuxDraft({ label: item.label });
  };

  const handleRemoveSurLesLieuxOption = (id: string) => {
    updateSettings((prev) => ({
      ...prev,
      messageSurLesLieuxOptions: prev.messageSurLesLieuxOptions.filter((item) => item.id !== id)
    }));
    if (editingSurLesLieuxId === id) {
      setEditingSurLesLieuxId(null);
      setSurLesLieuxDraft({ label: '' });
    }
  };

  const handleResetSurLesLieuxOptions = () => {
    updateSettings((prev) => ({ ...prev, messageSurLesLieuxOptions: getDefaultMessageSurLesLieuxOptions() }));
    setEditingSurLesLieuxId(null);
    setSurLesLieuxDraft({ label: '' });
  };

  const normalizeOctLabelDefaults = (draft: OctLabelDefaults) => {
    const normalized = getDefaultOctLabelDefaults();
    OCT_LABEL_OPTIONS.forEach((entry) => {
      const values = draft[entry.key] || [];
      const cleaned = values.map((value) => value.trim()).slice(0, entry.slots);
      while (cleaned.length < entry.slots) cleaned.push('');
      normalized[entry.key] = cleaned;
    });
    return normalized;
  };

  const handleOctLabelDefaultChange = (key: OctLabelKey, index: number, value: string) => {
    setOctLabelDefaultsDraft((prev) => {
      const current = prev[key] ? [...prev[key]] : [];
      while (current.length <= index) current.push('');
      current[index] = value;
      return { ...prev, [key]: current };
    });
  };

  const applyOctDefaults = (nextLabelDefaults: OctLabelDefaults) => {
    const previousLabelDefaults = settings.octLabelDefaults;
    const typeDefaults = settings.octDefaults;
    setOctLabelDefaultsDraft(nextLabelDefaults);
    updateSettings((prev) => ({ ...prev, octLabelDefaults: nextLabelDefaults }));
    setOctTree((prev) =>
      applyOctDefaultsToTree(prev, typeDefaults, typeDefaults, previousLabelDefaults, nextLabelDefaults)
    );
  };

  const handleResetOctDefaults = () => {
    applyOctDefaults(getDefaultOctLabelDefaults());
  };

  const handleValidateOctDefaults = () => {
    applyOctDefaults(normalizeOctLabelDefaults(octLabelDefaultsDraft));
  };

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const section = params.get('section') || (location.hash ? location.hash.replace('#', '') : null);
    if (section !== 'profile') return;
    setOpenSections((prev) => (prev.profile ? prev : { ...prev, profile: true }));
    const handleScroll = () => {
      profileSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    const raf = requestAnimationFrame(handleScroll);
    return () => cancelAnimationFrame(raf);
  }, [location.search, location.hash]);

  const toggleProfileShortcut = (key: ShortcutKey) => {
    setProfileDraft((prev) => ({
      ...prev,
      shortcutKeys: prev.shortcutKeys.includes(key)
        ? prev.shortcutKeys.filter((item) => item !== key)
        : [...prev.shortcutKeys, key]
    }));
  };

  const handleSaveProfile = async () => {
    if (!profile) return;
    setProfileSaving(true);
    const updated = await updateProfile({
      first_name: profileDraft.firstName.trim() || null,
      last_name: profileDraft.lastName.trim() || null,
      employment_level: profileDraft.employmentLevel || null,
      shortcut_keys: profileDraft.shortcutKeys
    });
    setProfileSaving(false);
    if (updated) {
      setProfileStatus('Profil mis à jour.');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const getHistoryType = (item: InterventionHistoryItem) =>
    normalizeEmploymentLevel(item.command_level) || normalizeEmploymentLevel(profile?.employment_level) || 'group';

  const handleOpenHistoryIntervention = (item: InterventionHistoryItem) => {
    const targetType = getHistoryType(item);
    const startedAtMs = item.created_at ? new Date(item.created_at).getTime() : Date.now();
    navigate(`/situation/${targetType}/dictate`, {
      state: { mode: 'resume', interventionId: item.id, startedAtMs }
    });
  };

  const canManageIntervention = (item: InterventionHistoryItem) =>
    item.role === 'owner' || item.role === 'admin';

  const handleDeleteIntervention = async (item: InterventionHistoryItem) => {
    if (!canManageIntervention(item)) return;
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm("Supprimer définitivement cette intervention ?");
      if (!confirmed) return;
    }
    setHistoryDeleteId(item.id);
    setHistoryDeleteError(null);
    const supabase = getSupabaseClient();
    if (!supabase) {
      setHistoryDeleteError('Configuration Supabase manquante.');
      setHistoryDeleteId(null);
      return;
    }
    try {
      const { error } = await supabase.from('interventions').delete().eq('id', item.id);
      if (error) throw error;
      if (historySelectedId === item.id) {
        setHistorySelectedId(null);
        setHistoryDetail(null);
        setHistoryDetailId(null);
        setHistoryDetailStatus('idle');
        setHistoryDetailError(null);
      }
      await fetchInterventionHistory();
    } catch (error) {
      console.error('Erreur suppression intervention', error);
      const message = error instanceof Error ? error.message : "Impossible de supprimer l'intervention.";
      setHistoryDeleteError(message);
    } finally {
      setHistoryDeleteId(null);
    }
  };

  const fetchInterventionHistory = useCallback(async () => {
    if (!user?.id) {
      setHistoryStatus('error');
      setHistoryError('Utilisateur non authentifié.');
      return;
    }
    setHistoryStatus('loading');
    setHistoryError(null);
    const supabase = getSupabaseClient();
    if (!supabase) {
      setHistoryStatus('error');
      setHistoryError('Configuration Supabase manquante.');
      return;
    }
    try {
      const { data, error } = await supabase
        .from('intervention_members')
        .select('intervention_id, role, command_level, interventions ( id, title, status, created_at, updated_at, address_line1, street_number, street_name, city, incident_number )')
        .eq('user_id', user.id);
      if (error) throw error;
      const normalized = (data ?? [])
        .map((row) => {
          const rawIntervention = (row as { interventions?: Record<string, unknown> | Record<string, unknown>[] }).interventions;
          const intervention = Array.isArray(rawIntervention) ? rawIntervention[0] ?? {} : rawIntervention ?? {};
          return {
            id: (intervention.id as string) || row.intervention_id,
            status: (intervention.status as string) || 'open',
            title: (intervention.title as string) ?? null,
            created_at: (intervention.created_at as string) ?? null,
            updated_at: (intervention.updated_at as string) ?? null,
            address_line1: (intervention.address_line1 as string) ?? null,
            street_number: (intervention.street_number as string) ?? null,
            street_name: (intervention.street_name as string) ?? null,
            city: (intervention.city as string) ?? null,
            incident_number: (intervention.incident_number as string) ?? null,
            command_level: (row as { command_level?: string | null }).command_level ?? null,
            role: (row as { role?: string | null }).role ?? null
          } satisfies InterventionHistoryItem;
        })
        .filter((item) => item.id);
      normalized.sort((a, b) => {
        const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
        const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
        return dateB - dateA;
      });
      setHistoryItems(normalized);
      setHistoryStatus('ready');
    } catch (error) {
      console.error('Erreur chargement historique', error);
      const message = error instanceof Error ? error.message : 'Impossible de charger l’historique.';
      setHistoryError(message);
      setHistoryStatus('error');
    }
  }, [user?.id]);

  const fetchInterventionDetails = useCallback(async (interventionId: string) => {
    setHistoryDetailStatus('loading');
    setHistoryDetailError(null);
    setHistoryDetailId(interventionId);
    const supabase = getSupabaseClient();
    if (!supabase) {
      setHistoryDetailStatus('error');
      setHistoryDetailError('Configuration Supabase manquante.');
      return;
    }
    try {
      const ordreInitialHistory: InterventionHistoryEntry<HydratedOrdreInitial>[] = [];
      const ordreConduiteHistory: InterventionHistoryEntry<HydratedOrdreConduite>[] = [];
      const messages: MessageHistoryEntry[] = [];
      const { data: eventRows, error: eventError } = await supabase
        .from('intervention_events')
        .select('id, event_type, payload, created_at, user_id, logical_id')
        .eq('intervention_id', interventionId)
        .in('event_type', [
          'OI_VALIDATED',
          'ORDRE_CONDUITE_VALIDATED',
          'MESSAGE_AMBIANCE_VALIDATED',
          'MESSAGE_COMPTE_RENDU_VALIDATED'
        ])
        .order('created_at', { ascending: false });
      if (eventError) throw eventError;
      (eventRows ?? []).forEach((row) => {
        if (row.event_type === 'OI_VALIDATED') {
          const parsed = parseOiPayload(row.payload, row.created_at ?? undefined);
          if (!parsed) return;
          ordreInitialHistory.push({
            id: row.id,
            createdAt: row.created_at,
            userId: row.user_id ?? null,
            logicalId: row.logical_id ?? null,
            payload: parsed
          });
          return;
        }
        if (row.event_type === 'ORDRE_CONDUITE_VALIDATED') {
          const parsed = parseConduitePayload(row.payload, row.created_at ?? undefined);
          if (!parsed) return;
          ordreConduiteHistory.push({
            id: row.id,
            createdAt: row.created_at,
            userId: row.user_id ?? null,
            logicalId: row.logical_id ?? null,
            payload: parsed
          });
          return;
        }
        if (row.event_type === 'MESSAGE_AMBIANCE_VALIDATED' || row.event_type === 'MESSAGE_COMPTE_RENDU_VALIDATED') {
          const parsed = parseMessagePayload(row.payload);
          if (!parsed || !row.created_at) return;
          messages.push({
            id: row.id,
            createdAt: row.created_at,
            type: row.event_type,
            payload: parsed
          });
        }
      });

      let means: MeanItem[] = [];
      let octCounts: InterventionHistoryDetails['octCounts'] = null;
      const { data: meansRows, error: meansError } = await supabase
        .from('intervention_means_state')
        .select('data')
        .eq('intervention_id', interventionId)
        .limit(1);
      if (meansError) throw meansError;
      const raw = meansRows?.[0]?.data as { selectedMeans?: unknown[]; octTree?: unknown } | null | undefined;
      means = normalizeMeanItems(raw?.selectedMeans);
      if (raw?.octTree && isOctTreeNode(raw.octTree)) {
        octCounts = countOctNodes(raw.octTree);
      }

      const { data: sitacRows, error: sitacError } = await supabase
        .from('sitac_features')
        .select('feature_id, symbol_type, lat, lng, props')
        .eq('intervention_id', interventionId);
      if (sitacError) throw sitacError;
      const sitacFeatures = (sitacRows ?? []).map((row) => buildSitacHistoryFeature(row as SitacHistoryRow));
      const sitacCount = sitacFeatures.length;

      setHistoryDetail({
        ordreInitialHistory,
        ordreConduiteHistory,
        means,
        messages,
        sitacFeatures,
        sitacCount,
        octCounts
      });
      setHistoryDetailStatus('ready');
    } catch (error) {
      console.error('Erreur détails intervention', error);
      const message = error instanceof Error ? error.message : 'Impossible de charger le détail.';
      setHistoryDetailError(message);
      setHistoryDetailStatus('error');
    }
  }, []);

  const handleToggleHistoryItem = (interventionId: string) => {
    if (historySelectedId === interventionId) {
      setHistorySelectedId(null);
      setHistoryDetail(null);
      setHistoryDetailId(null);
      setHistoryDetailStatus('idle');
      setHistoryDetailError(null);
      setHistoryDeleteError(null);
      return;
    }
    setHistorySelectedId(interventionId);
    setHistoryDetail(null);
    setHistoryDetailError(null);
    setHistoryDeleteError(null);
    void fetchInterventionDetails(interventionId);
  };

  useEffect(() => {
    if (openSections['intervention-history'] && historyStatus === 'idle') {
      void fetchInterventionHistory();
    }
  }, [openSections, historyStatus, fetchInterventionHistory]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#0A0A0A] dark:text-white">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-200/70 dark:bg-blue-900/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-slate-200/70 dark:bg-gray-900/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 py-6 flex flex-col items-center h-full">
        <div className="flex flex-col items-center mb-8 animate-fade-in-down">
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-gray-400 mb-2">
            Paramètres
          </h1>
          <p className="text-slate-600 dark:text-gray-400 text-center text-sm font-light tracking-wide">
            Gérez vos préférences et consultez les informations de l'application
          </p>
        </div>

        <div className="w-full max-w-2xl space-y-4 animate-fade-in-down" style={{ animationDelay: '0.1s' }}>
          {/* Profil Section */}
          <div
            ref={profileSectionRef}
            id="profile"
            className="bg-white/80 border border-slate-200 dark:bg-[#151515] dark:border-white/10 rounded-2xl transition-all duration-300 hover:border-slate-300 dark:hover:border-white/20"
          >
            <button
              type="button"
              onClick={() => toggleSection('profile')}
              aria-expanded={Boolean(openSections.profile)}
              className="w-full px-6 py-4 flex items-center justify-between gap-4 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-200/60 dark:bg-blue-500/20 rounded-lg">
                  <User className="w-5 h-5 text-blue-700 dark:text-blue-300" />
                </div>
                <div>
                  <div className="font-medium text-lg">Profil</div>
                  <div className="text-xs text-slate-500 dark:text-gray-400">
                    Identité et niveau d’emploi pour personnaliser l’expérience.
                  </div>
                </div>
              </div>
              {openSections.profile ? (
                <ChevronUp className="w-5 h-5 text-slate-500 dark:text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-500 dark:text-gray-400" />
              )}
            </button>

            {openSections.profile && (
              <div className="px-6 pb-6 space-y-4">
                {profileLoading ? (
                  <div className="text-sm text-slate-500 dark:text-gray-400">Chargement du profil...</div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs uppercase tracking-wide text-slate-500 dark:text-gray-400">Prénom</label>
                        <input
                          value={profileDraft.firstName}
                          onChange={(e) => setProfileDraft((prev) => ({ ...prev, firstName: e.target.value }))}
                          className="w-full bg-slate-100 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm"
                          placeholder="Prénom"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs uppercase tracking-wide text-slate-500 dark:text-gray-400">Nom</label>
                        <input
                          value={profileDraft.lastName}
                          onChange={(e) => setProfileDraft((prev) => ({ ...prev, lastName: e.target.value }))}
                          className="w-full bg-slate-100 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm"
                          placeholder="Nom"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs uppercase tracking-wide text-slate-500 dark:text-gray-400">Niveau d’emploi</label>
                      <select
                        value={profileDraft.employmentLevel}
                        onChange={(e) =>
                          setProfileDraft((prev) => ({ ...prev, employmentLevel: e.target.value as EmploymentLevel }))
                        }
                        className="w-full bg-slate-100 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm"
                      >
                        <option value="">Sélectionner</option>
                        {EMPLOYMENT_LEVEL_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-500 dark:text-gray-400">
                        <span>Raccourcis rapides</span>
                        <span className="normal-case text-[11px]">Personnalisables</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {SHORTCUT_OPTIONS.map((shortcut) => (
                          <label
                            key={shortcut.key}
                            className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition ${
                              profileDraft.shortcutKeys.includes(shortcut.key)
                                ? 'border-blue-500/40 bg-blue-500/10 text-slate-900 dark:text-white'
                                : 'border-slate-200 bg-slate-100 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={profileDraft.shortcutKeys.includes(shortcut.key)}
                              onChange={() => toggleProfileShortcut(shortcut.key)}
                            />
                            <span>{shortcut.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-3 py-2 text-xs text-slate-500 dark:text-gray-400">
                      Email associé : <span className="font-medium text-slate-700 dark:text-gray-200">{user?.email || '-'}</span>
                      <div className="mt-1 text-[11px] text-slate-400 dark:text-gray-500">
                        Pour changer d’email, utilisez la procédure Supabase dédiée (lien de confirmation envoyé par mail).
                      </div>
                    </div>

                    {profileError && (
                      <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
                        {profileError}
                      </div>
                    )}
                    {profileStatus && (
                      <div className="text-sm text-emerald-600 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2">
                        {profileStatus}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleSaveProfile}
                      disabled={!isProfileDirty || profileSaving}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600/90 hover:bg-blue-600 text-white text-sm font-semibold shadow-sm transition disabled:opacity-60"
                    >
                      {profileSaving ? 'Enregistrement...' : 'Enregistrer le profil'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Theme Section */}
          <div className="bg-white/80 border border-slate-200 dark:bg-[#151515] dark:border-white/10 rounded-2xl transition-all duration-300 hover:border-slate-300 dark:hover:border-white/20">
            <button
              type="button"
              onClick={() => toggleSection('theme')}
              aria-expanded={Boolean(openSections.theme)}
              className="w-full px-6 py-4 flex items-center justify-between gap-4 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-200/60 dark:bg-amber-500/20 rounded-lg">
                  <Sun className="w-5 h-5 text-amber-600 dark:text-amber-300" />
                </div>
                <div>
                  <div className="font-medium text-lg">Apparence</div>
                  <div className="text-xs text-slate-500 dark:text-gray-400">
                    Mode actuel : {resolvedTheme === 'dark' ? 'Sombre' : 'Clair'}{theme === 'system' ? ' (auto)' : ''}
                  </div>
                </div>
              </div>
              {openSections.theme ? (
                <ChevronUp className="w-5 h-5 text-slate-500 dark:text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-500 dark:text-gray-400" />
              )}
            </button>

            {openSections.theme && (
              <div className="px-6 pb-6">
                <ThemeSelector />
              </div>
            )}
          </div>

          {/* Recueil des moyens */}
          <div className="bg-white/80 border border-slate-200 dark:bg-[#151515] dark:border-white/10 rounded-2xl transition-all duration-300 hover:border-slate-300 dark:hover:border-white/20">
            <button
              type="button"
              onClick={() => toggleSection('means')}
              aria-expanded={Boolean(openSections.means)}
              className="w-full px-6 py-4 flex items-start justify-between gap-4 text-left"
            >
              <div>
                <div className="font-medium text-lg">Recueil des moyens</div>
                <div className="text-xs text-slate-500 dark:text-gray-400">
                  Session uniquement. Si aucun moyen personnalisé n'est défini, le recueil standard est utilisé.
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500 dark:text-gray-400 bg-white/70 dark:bg-white/5 px-2 py-1 rounded-full">
                  Session
                </span>
                {openSections.means ? (
                  <ChevronUp className="w-5 h-5 text-slate-500 dark:text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-500 dark:text-gray-400" />
                )}
              </div>
            </button>

            {openSections.means && (
              <div className="px-6 pb-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-[1.4fr,0.8fr,auto] gap-2 items-end">
                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-wide text-slate-500 dark:text-gray-400">Nom</label>
                    <input
                      value={meanDraft.name}
                      onChange={(e) => setMeanDraft((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Ex: FPT, VSAV, EPA"
                      className="w-full bg-slate-100 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-wide text-slate-500 dark:text-gray-400">Catégorie</label>
                    <select
                      value={meanDraft.category}
                      onChange={(e) => setMeanDraft((prev) => ({ ...prev, category: e.target.value as MeansCategoryKey }))}
                      className="w-full bg-slate-100 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm"
                    >
                      {MEANS_CATEGORIES.map((cat) => (
                        <option key={cat.key} value={cat.key}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleSaveMean}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600/90 hover:bg-blue-600 text-white text-sm font-semibold shadow-sm transition"
                  >
                    <Plus className="w-4 h-4" />
                    {editingMeanId ? 'Mettre à jour' : 'Ajouter'}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleLoadDefaultMeans}
                    className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-200 hover:bg-slate-300 border border-slate-300 text-slate-700 dark:bg-white/10 dark:hover:bg-white/20 dark:border-white/15 dark:text-gray-200 transition"
                  >
                    Charger les moyens standards
                  </button>
                  <button
                    onClick={handleClearMeans}
                    className="px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:bg-white/5 dark:border-white/10 dark:text-gray-300 dark:hover:text-white transition"
                  >
                    Vider le recueil
                  </button>
                </div>

                <div className="space-y-2">
                  {sortedMeansCatalog.length === 0 ? (
                    <div className="text-sm text-slate-500 dark:text-gray-400">
                      Aucun moyen personnalisé. Le recueil standard restera disponible.
                    </div>
                  ) : (
                    sortedMeansCatalog.map((item) => {
                      const categoryLabel = MEANS_CATEGORIES.find((cat) => cat.key === item.category)?.label || item.category;
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 px-3 py-2"
                        >
                          <div>
                            <div className="text-sm font-medium text-slate-800 dark:text-gray-200">{item.name}</div>
                            <div className="text-[11px] text-slate-500 dark:text-gray-400">{categoryLabel}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEditMean(item)}
                              className="px-2 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:border-slate-300 dark:bg-white/5 dark:border-white/10 dark:text-gray-300 dark:hover:text-white transition"
                            >
                              Modifier
                            </button>
                            <button
                              onClick={() => handleRemoveMean(item.id)}
                              className="p-2 rounded-lg bg-white border border-slate-200 text-red-600 hover:bg-red-50 transition dark:bg-white/5 dark:hover:bg-red-500/20 dark:border-white/10 dark:text-red-300"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Messages - cases à cocher */}
          <div className="bg-white/80 border border-slate-200 dark:bg-[#151515] dark:border-white/10 rounded-2xl transition-all duration-300 hover:border-slate-300 dark:hover:border-white/20">
            <button
              type="button"
              onClick={() => toggleSection('messages')}
              aria-expanded={Boolean(openSections.messages)}
              className="w-full px-6 py-4 flex items-start justify-between gap-4 text-left"
            >
              <div>
                <div className="font-medium text-lg">Messages - cases à cocher</div>
                <div className="text-xs text-slate-500 dark:text-gray-400">
                  Personnalisez les cases visibles dans les messages d&apos;ambiance et de compte rendu. Session uniquement.
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500 dark:text-gray-400 bg-white/70 dark:bg-white/5 px-2 py-1 rounded-full">
                  Session
                </span>
                {openSections.messages ? (
                  <ChevronUp className="w-5 h-5 text-slate-500 dark:text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-500 dark:text-gray-400" />
                )}
              </div>
            </button>

            {openSections.messages && (
              <div className="px-6 pb-6 space-y-6">
              <div className="space-y-3">
                <div className="text-sm font-semibold text-slate-700 dark:text-gray-200">Je demande</div>
                <div className="grid grid-cols-1 md:grid-cols-[1fr,auto] gap-2 items-end">
                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-wide text-slate-500 dark:text-gray-400">Libellé</label>
                    <input
                      value={demandeDraft.label}
                      onChange={(e) => setDemandeDraft({ label: e.target.value })}
                      placeholder="Ex: Équipe médicale"
                      className="w-full bg-slate-100 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm"
                    />
                  </div>
                  <button
                    onClick={handleSaveDemandeOption}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600/90 hover:bg-blue-600 text-white text-sm font-semibold shadow-sm transition"
                  >
                    <Plus className="w-4 h-4" />
                    {editingDemandeId ? 'Mettre à jour' : 'Ajouter'}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleResetDemandeOptions}
                    className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-200 hover:bg-slate-300 border border-slate-300 text-slate-700 dark:bg-white/10 dark:hover:bg-white/20 dark:border-white/15 dark:text-gray-200 transition"
                  >
                    Réinitialiser la liste
                  </button>
                </div>

                <div className="space-y-2">
                  {messageDemandeOptions.length === 0 ? (
                    <div className="text-sm text-slate-500 dark:text-gray-400">
                      Aucune case définie. Réinitialisez pour restaurer la liste standard.
                    </div>
                  ) : (
                    messageDemandeOptions.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 px-3 py-2"
                      >
                        <div className="text-sm font-medium text-slate-800 dark:text-gray-200">{item.label}</div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditDemandeOption(item)}
                            className="px-2 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:border-slate-300 dark:bg-white/5 dark:border-white/10 dark:text-gray-300 dark:hover:text-white transition"
                          >
                            Modifier
                          </button>
                          <button
                            onClick={() => handleRemoveDemandeOption(item.id)}
                            className="p-2 rounded-lg bg-white border border-slate-200 text-red-600 hover:bg-red-50 transition dark:bg-white/5 dark:hover:bg-red-500/20 dark:border-white/10 dark:text-red-300"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-slate-200/70 dark:border-white/10">
                <div className="text-sm font-semibold text-slate-700 dark:text-gray-200">Sur les lieux</div>
                <div className="grid grid-cols-1 md:grid-cols-[1fr,auto] gap-2 items-end">
                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-wide text-slate-500 dark:text-gray-400">Libellé</label>
                    <input
                      value={surLesLieuxDraft.label}
                      onChange={(e) => setSurLesLieuxDraft({ label: e.target.value })}
                      placeholder="Ex: Feu circonscrit"
                      className="w-full bg-slate-100 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm"
                    />
                  </div>
                  <button
                    onClick={handleSaveSurLesLieuxOption}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600/90 hover:bg-blue-600 text-white text-sm font-semibold shadow-sm transition"
                  >
                    <Plus className="w-4 h-4" />
                    {editingSurLesLieuxId ? 'Mettre à jour' : 'Ajouter'}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleResetSurLesLieuxOptions}
                    className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-200 hover:bg-slate-300 border border-slate-300 text-slate-700 dark:bg-white/10 dark:hover:bg-white/20 dark:border-white/15 dark:text-gray-200 transition"
                  >
                    Réinitialiser la liste
                  </button>
                </div>

                <div className="space-y-2">
                  {messageSurLesLieuxOptions.length === 0 ? (
                    <div className="text-sm text-slate-500 dark:text-gray-400">
                      Aucune case définie. Réinitialisez pour restaurer la liste standard.
                    </div>
                  ) : (
                    messageSurLesLieuxOptions.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 px-3 py-2"
                      >
                        <div className="text-sm font-medium text-slate-800 dark:text-gray-200">{item.label}</div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditSurLesLieuxOption(item)}
                            className="px-2 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:border-slate-300 dark:bg-white/5 dark:border-white/10 dark:text-gray-300 dark:hover:text-white transition"
                          >
                            Modifier
                          </button>
                          <button
                            onClick={() => handleRemoveSurLesLieuxOption(item.id)}
                            className="p-2 rounded-lg bg-white border border-slate-200 text-red-600 hover:bg-red-50 transition dark:bg-white/5 dark:hover:bg-red-500/20 dark:border-white/10 dark:text-red-300"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              </div>
            )}
          </div>

          {/* OCT - Fréquences par défaut */}
          <div className="bg-white/80 border border-slate-200 dark:bg-[#151515] dark:border-white/10 rounded-2xl transition-all duration-300 hover:border-slate-300 dark:hover:border-white/20">
            <button
              type="button"
              onClick={() => toggleSection('oct')}
              aria-expanded={Boolean(openSections.oct)}
              className="w-full px-6 py-4 flex items-start justify-between gap-4 text-left"
            >
              <div>
                <div className="font-medium text-lg">OCT - Fréquences par défaut</div>
                <div className="text-xs text-slate-500 dark:text-gray-400">
                  Appliquées aux noeuds portant ces libellés lors de la validation.
                </div>
              </div>
              {openSections.oct ? (
                <ChevronUp className="w-5 h-5 text-slate-500 dark:text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-500 dark:text-gray-400" />
              )}
            </button>

            {openSections.oct && (
              <div className="px-6 pb-6 space-y-4">
                <div className="space-y-3">
                  {OCT_LABEL_OPTIONS.map((entry) => (
                    <div key={entry.key} className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 px-3 py-3">
                      <div className="text-sm font-semibold text-slate-700 dark:text-gray-200">{entry.label}</div>
                      <div className={`grid gap-2 mt-2 ${entry.slots > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                        {Array.from({ length: entry.slots }).map((_, index) => (
                          <div key={`${entry.key}-${index}`} className="space-y-1">
                            <label className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-gray-400">
                              {entry.slots > 1 ? `Fréq. ${index + 1}` : 'Fréquence'}
                            </label>
                            <input
                              value={octLabelDefaultsDraft[entry.key]?.[index] || ''}
                              onChange={(e) => handleOctLabelDefaultChange(entry.key, index, e.target.value)}
                              placeholder="Ex: 230"
                              className="w-full bg-white dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap justify-end items-center gap-2">
                  <button
                    onClick={handleResetOctDefaults}
                    className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-200 hover:bg-slate-300 border border-slate-300 text-slate-700 dark:bg-white/10 dark:hover:bg-white/20 dark:border-white/15 dark:text-gray-200 transition"
                  >
                    Réinitialiser
                  </button>
                  <button
                    onClick={handleValidateOctDefaults}
                    disabled={!isOctDefaultsDirty}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                      isOctDefaultsDirty
                        ? 'bg-blue-600/90 hover:bg-blue-600 border-blue-600 text-white'
                        : 'bg-slate-200 border-slate-200 text-slate-400 cursor-not-allowed dark:bg-white/5 dark:border-white/5 dark:text-gray-500'
                    }`}
                  >
                    Valider
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Historique des interventions */}
          <div className="bg-white/80 border border-slate-200 dark:bg-[#151515] dark:border-white/10 rounded-2xl transition-all duration-300 hover:border-slate-300 dark:hover:border-white/20">
            <button
              type="button"
              onClick={() => toggleSection('intervention-history')}
              aria-expanded={Boolean(openSections['intervention-history'])}
              className="w-full px-6 py-4 flex items-center justify-between gap-4 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-200/60 dark:bg-amber-500/20 rounded-lg">
                  <History className="w-5 h-5 text-amber-700 dark:text-amber-300" />
                </div>
                <div>
                  <div className="font-medium text-lg">Historique des interventions</div>
                  <div className="text-xs text-slate-500 dark:text-gray-400">
                    Retrouvez les interventions clôturées et les détails associés.
                  </div>
                </div>
              </div>
              {openSections['intervention-history'] ? (
                <ChevronUp className="w-5 h-5 text-slate-500 dark:text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-500 dark:text-gray-400" />
              )}
            </button>

            {openSections['intervention-history'] && (
              <div className="px-6 pb-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-gray-400">
                  <div>Chargement auto à l’ouverture.</div>
                  <button
                    onClick={() => fetchInterventionHistory()}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-white/5 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/10 transition"
                  >
                    Rafraîchir
                  </button>
                </div>

                {historyStatus === 'loading' && (
                  <div className="text-sm text-slate-500 dark:text-gray-400">Chargement de l’historique…</div>
                )}
                {historyStatus === 'error' && historyError && (
                  <div className="text-sm text-red-600 dark:text-red-300">{historyError}</div>
                )}
                {historyStatus === 'ready' && historyItems.length === 0 && (
                  <div className="text-sm text-slate-500 dark:text-gray-400">Aucune intervention disponible.</div>
                )}
                {historyStatus === 'ready' && historyItems.length > 0 && (
                  <div className="space-y-3">
                    {historyItems.map((item) => {
                      const addressLine = buildAddressLine(item);
                      const cityLine = buildCityLine(item);
                      const dateLabel = formatInterventionDate(item.updated_at || item.created_at);
                      const isClosed = item.status === 'closed';
                      const isDetailReady = historyDetailStatus === 'ready' && historyDetailId === item.id && historyDetail;
                      return (
                        <div
                          key={item.id}
                          className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 px-4 py-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                {item.incident_number ? `Intervention ${item.incident_number}` : item.title || `Intervention ${item.id.slice(0, 8)}`}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-gray-400">
                                {[addressLine, cityLine].filter(Boolean).join(' • ') || 'Adresse non renseignée'}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-gray-400">
                                {dateLabel ? `Mis à jour ${dateLabel}` : 'Date inconnue'} • {isClosed ? 'Clôturée' : 'En cours'}
                              </div>
                            </div>
                            <button
                              onClick={() => handleToggleHistoryItem(item.id)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition"
                            >
                              {historySelectedId === item.id ? 'Masquer le détail' : 'Voir le détail'}
                            </button>
                          </div>

                          {historySelectedId === item.id && (
                            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/10 space-y-4">
                              {historyDetailStatus === 'loading' && (
                                <div className="text-sm text-slate-500 dark:text-gray-400">Chargement du détail…</div>
                              )}
                              {historyDetailStatus === 'error' && historyDetailError && (
                                <div className="text-sm text-red-600 dark:text-red-300">{historyDetailError}</div>
                              )}
                              {isDetailReady && (
                                <div className="space-y-5">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="text-xs text-slate-500 dark:text-gray-400">
                                      Accès complet depuis le mode reprise.
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => handleOpenHistoryIntervention(item)}
                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition"
                                      >
                                        Ouvrir l’intervention
                                      </button>
                                      {canManageIntervention(item) && (
                                        <button
                                          onClick={() => handleDeleteIntervention(item)}
                                          disabled={historyDeleteId === item.id}
                                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                          {historyDeleteId === item.id ? 'Suppression…' : 'Supprimer'}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  {historyDeleteError && historySelectedId === item.id && (
                                    <div className="text-sm text-red-600 dark:text-red-300">{historyDeleteError}</div>
                                  )}
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-3">
                                      <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">Moyens</div>
                                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                        {historyDetail.means.length} moyen{historyDetail.means.length > 1 ? 's' : ''}
                                      </div>
                                      {historyDetail.means.length > 0 ? (
                                        <div className="mt-2 text-xs text-slate-600 dark:text-gray-300 whitespace-pre-wrap">
                                          {historyDetail.means
                                            .map((mean) => `${mean.name} • ${mean.status === 'demande' ? 'Demandé' : 'Sur place'}`)
                                            .join('\n')}
                                        </div>
                                      ) : (
                                        <div className="text-xs text-slate-500 dark:text-gray-400 mt-1">Aucun moyen enregistré.</div>
                                      )}
                                    </div>
                                    <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-3 space-y-1">
                                      <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">SITAC</div>
                                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                        {historyDetail.sitacCount} élément{historyDetail.sitacCount > 1 ? 's' : ''}
                                      </div>
                                      {historyDetail.octCounts && (
                                        <div className="text-xs text-slate-600 dark:text-gray-300">
                                          OCT: {historyDetail.octCounts.total} noeud{historyDetail.octCounts.total > 1 ? 's' : ''} • {historyDetail.octCounts.sectors} secteur{historyDetail.octCounts.sectors > 1 ? 's' : ''} • {historyDetail.octCounts.engines} engin{historyDetail.octCounts.engines > 1 ? 's' : ''}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <h4 className="text-sm font-semibold text-slate-800 dark:text-gray-100">Messages</h4>
                                    {historyDetail.messages.length ? (
                                      <div className="space-y-3">
                                        {historyDetail.messages.map((entry) => {
                                          const demandesSummary = buildDemandesSummary(entry.payload, messageDemandeOptions);
                                          const surLesLieuxSummary = buildSurLesLieuxSummary(entry.payload, messageSurLesLieuxOptions);
                                          return (
                                            <div key={entry.id} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 px-3 py-2">
                                              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                                {entry.type === 'MESSAGE_AMBIANCE_VALIDATED' ? 'Message ambiance' : 'Message compte rendu'} • {formatHistoryTimestamp(entry.createdAt)}
                                              </div>
                                              <div className="text-xs text-slate-500 dark:text-gray-400">
                                                {entry.payload.date || entry.payload.time ? `${entry.payload.date || ''} ${entry.payload.time || ''}`.trim() : 'Horodatage non renseigné'}
                                              </div>
                                              <div className="mt-2 grid gap-2 text-xs text-slate-700 dark:text-gray-200">
                                                {entry.payload.jeSuis && <div>Je suis: {entry.payload.jeSuis}</div>}
                                                {entry.payload.jeVois && <div>Je vois: {entry.payload.jeVois}</div>}
                                                {entry.payload.jeDemande && <div>Je demande: {entry.payload.jeDemande}</div>}
                                                {entry.payload.jePrevois && <div>Je prévois: {entry.payload.jePrevois}</div>}
                                                {entry.payload.jeFais && <div>Je fais: {entry.payload.jeFais}</div>}
                                                {demandesSummary.length > 0 && (
                                                  <div>Demandes: {demandesSummary.join(', ')}</div>
                                                )}
                                                {surLesLieuxSummary.length > 0 && (
                                                  <div>Sur les lieux: {surLesLieuxSummary.join(', ')}</div>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <div className="text-xs text-slate-500 dark:text-gray-400">Aucun message validé.</div>
                                    )}
                                  </div>

                                  <div className="space-y-2">
                                    <h4 className="text-sm font-semibold text-slate-800 dark:text-gray-100">SITAC</h4>
                                    {historyDetail.sitacFeatures.length ? (
                                      <div className="grid gap-2 sm:grid-cols-2">
                                        {historyDetail.sitacFeatures.slice(0, 20).map((feature) => (
                                          <div
                                            key={feature.id}
                                            className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/5 px-2 py-1.5"
                                          >
                                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: feature.color }} />
                                            <div className="text-xs text-slate-700 dark:text-gray-200">
                                              <span className="font-semibold">{feature.label}</span>
                                              <span className="text-slate-500 dark:text-gray-400"> • {feature.symbolType}</span>
                                            </div>
                                          </div>
                                        ))}
                                        {historyDetail.sitacFeatures.length > 20 && (
                                          <div className="text-xs text-slate-500 dark:text-gray-400">
                                            +{historyDetail.sitacFeatures.length - 20} autres éléments
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="text-xs text-slate-500 dark:text-gray-400">Aucun élément SITAC.</div>
                                    )}
                                  </div>

                                  <div className="space-y-2">
                                    <h4 className="text-sm font-semibold text-slate-800 dark:text-gray-100">Ordre initial</h4>
                                    {historyDetail.ordreInitialHistory.length ? (
                                      <div className="space-y-3">
                                        {historyDetail.ordreInitialHistory.map((entry) => (
                                          <div key={entry.id} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 px-3 py-2">
                                            <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                              Validé le {formatHistoryTimestamp(entry.createdAt)}
                                            </div>
                                            <div className="text-xs text-slate-500 dark:text-gray-400">
                                              {entry.payload.soiecType ? `${entry.payload.soiecType} • ` : ''}Risques: {entry.payload.selectedRisks?.length ?? 0}
                                            </div>
                                            <div className="mt-3 grid gap-3 text-xs">
                                              <div>
                                                <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">Situation</div>
                                                <div className="text-sm text-slate-800 dark:text-gray-200 whitespace-pre-wrap">
                                                  {getSimpleSectionText(entry.payload.ordreData?.S) || '-'}
                                                </div>
                                              </div>
                                              <div>
                                                <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">Objectifs</div>
                                                <div className="text-sm text-slate-800 dark:text-gray-200 whitespace-pre-wrap">{formatList(entry.payload.ordreData?.O)}</div>
                                              </div>
                                              <div>
                                                <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">Idée de manœuvre</div>
                                                <div className="text-sm text-slate-800 dark:text-gray-200 whitespace-pre-wrap">{formatIdeeManoeuvre(entry.payload.ordreData?.I || [])}</div>
                                              </div>
                                              <div>
                                                <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">Exécution</div>
                                                <div className="text-sm text-slate-800 dark:text-gray-200 whitespace-pre-wrap">{formatExecution(entry.payload.ordreData?.E)}</div>
                                              </div>
                                              <div>
                                                <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">Commandement</div>
                                                <div className="text-sm text-slate-800 dark:text-gray-200 whitespace-pre-wrap">
                                                  {getSimpleSectionText(entry.payload.ordreData?.C) || '-'}
                                                </div>
                                              </div>
                                              {getSimpleSectionContentList(entry.payload.ordreData?.A).length > 0 && (
                                                <div>
                                                  <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">Anticipation</div>
                                                  <div className="text-sm text-slate-800 dark:text-gray-200 whitespace-pre-wrap">{formatList(entry.payload.ordreData?.A)}</div>
                                                </div>
                                              )}
                                              {getSimpleSectionContentList(entry.payload.ordreData?.L).length > 0 && (
                                                <div>
                                                  <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">Logistique</div>
                                                  <div className="text-sm text-slate-800 dark:text-gray-200 whitespace-pre-wrap">{formatList(entry.payload.ordreData?.L)}</div>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="text-xs text-slate-500 dark:text-gray-400">Aucun ordre initial validé.</div>
                                    )}
                                  </div>

                                  <div className="space-y-2">
                                    <h4 className="text-sm font-semibold text-slate-800 dark:text-gray-100">Ordre de conduite</h4>
                                    {historyDetail.ordreConduiteHistory.length ? (
                                      <div className="space-y-2">
                                        {historyDetail.ordreConduiteHistory.map((entry) => (
                                          <div key={entry.id} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 px-3 py-2">
                                            <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                              Validé le {formatHistoryTimestamp(entry.createdAt)}
                                            </div>
                                            <div className="text-xs text-slate-500 dark:text-gray-400">
                                              Risques: {entry.payload.conduiteSelectedRisks?.length ?? 0}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="text-xs text-slate-500 dark:text-gray-400">Aucun ordre de conduite validé.</div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Release Notes Section */}
          <div className="bg-white/80 border border-slate-200 dark:bg-[#151515] dark:border-white/10 rounded-2xl overflow-hidden transition-all duration-300 hover:border-slate-300 dark:hover:border-white/20">
            <button
              type="button"
              onClick={() => toggleSection('release-notes')}
              className="w-full px-6 py-4 flex items-center justify-between bg-slate-100/80 hover:bg-slate-200/80 dark:bg-white/5 dark:hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-500/20 rounded-lg">
                  <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="font-medium text-lg">Nouveautés</span>
              </div>
              {openSections['release-notes'] ? (
                <ChevronUp className="w-5 h-5 text-slate-500 dark:text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-500 dark:text-gray-400" />
              )}
            </button>

            {openSections['release-notes'] && (
              <div className="px-6 py-4 space-y-6 bg-slate-50/80 dark:bg-[#0A0A0A]/50">
                {RELEASE_NOTES.map((release, index) => (
                  <div key={index} className="border-l-2 border-blue-300 dark:border-blue-500/30 pl-4 ml-2">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-blue-600 dark:text-blue-400 text-lg">Version {release.version}</h3>
                      <span className="text-xs text-slate-500 dark:text-gray-500 bg-white/70 dark:bg-white/5 px-2 py-1 rounded-full">{release.date}</span>
                    </div>
                    <ul className="space-y-2">
                      {release.changes.map((change, changeIndex) => (
                        <li key={changeIndex} className="text-slate-600 dark:text-gray-300 text-sm flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-gray-500 mt-1.5 flex-shrink-0" />
                          {change}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Other Settings Placeholders */}
          <div className="bg-white/70 border border-slate-200 dark:bg-[#151515] dark:border-white/10 rounded-2xl p-6 flex items-center justify-between opacity-50 cursor-not-allowed">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-500/20 rounded-lg">
                <Bell className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <span className="font-medium text-lg">Notifications</span>
            </div>
            <span className="text-xs text-slate-500 dark:text-gray-500 bg-white/70 dark:bg-white/5 px-2 py-1 rounded-full">Bientôt disponible</span>
          </div>

          <div className="bg-white/70 border border-slate-200 dark:bg-[#151515] dark:border-white/10 rounded-2xl p-6 flex items-center justify-between opacity-50 cursor-not-allowed">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-500/20 rounded-lg">
                <Shield className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <span className="font-medium text-lg">Sécurité</span>
            </div>
            <span className="text-xs text-slate-500 dark:text-gray-500 bg-white/70 dark:bg-white/5 px-2 py-1 rounded-full">Bientôt disponible</span>
          </div>

          <button
            onClick={handleLogout}
            className="w-full mt-8 bg-red-50 hover:bg-red-100 border border-red-200 hover:border-red-300 text-red-600 hover:text-red-500 dark:bg-red-500/10 dark:hover:bg-red-500/20 dark:border-red-500/20 dark:hover:border-red-500/40 dark:text-red-400 dark:hover:text-red-300 py-4 rounded-2xl text-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 group"
          >
            <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
            Se déconnecter
          </button>
        </div>

        <div className="w-full max-w-2xl mt-8 mb-[calc(env(safe-area-inset-bottom,0)+12px)] animate-fade-in-down" style={{ animationDelay: '0.2s' }}>
          <button
            onClick={() => navigate('/')}
            className="w-full bg-white/80 hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10 dark:text-gray-300 dark:hover:text-white py-4 rounded-2xl text-lg font-medium transition-all duration-200"
          >
            Retour à l'accueil
          </button>
        </div>

        <div className="mt-8 text-center text-slate-500 dark:text-gray-600 text-xs animate-fade-in-down" style={{ animationDelay: '0.3s' }}>
          <p>{APP_NAME} v{APP_VERSION}</p>
          <p className="mt-1">© Fabien - 2025</p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
