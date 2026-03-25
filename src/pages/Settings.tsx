import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Info, Bell, Shield, LogOut, Sun, Plus, Trash2, User, Sliders, Bot, RefreshCw, CheckCircle2, AlertTriangle, Link2 } from 'lucide-react';
import { RELEASE_NOTES } from '../constants/releaseNotes';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';
import { APP_NAME, APP_VERSION } from '../constants/appInfo';
import ThemeSelector from '../components/ThemeSelector';
import { useTheme } from '../contexts/ThemeContext';
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
  type MessageCheckboxOption,
  OctFrequencyDefaults,
  OctLabelDefaults,
  OctLabelKey,
  useSessionSettings
} from '../utils/sessionSettings';
import { useAppSettings, type OperationalTabId } from '../utils/appSettings';
import { OctTreeNode, createInitialOctTree, setOctTree } from '../utils/octTreeStore';
import { checkOpenAIProxyHealth, getOpenAIProxyConfig, type OpenAIProxyHealth } from '../utils/openai';
import { buildDoctrineMeans, getDoctrineCategories } from '../utils/meansCatalog';
import InterventionHistorySection from '../components/settings/InterventionHistorySection';

const OCT_LABEL_OPTIONS: Array<{ key: OctLabelKey; label: string; slots: number }> = [
  { key: 'cdt', label: 'CDT', slots: 1 },
  { key: 'ope1', label: 'OPE 1', slots: 1 },
  { key: 'ope2', label: 'OPE 2', slots: 1 },
  { key: 'tact12', label: 'TACT 1/2', slots: 4 },
  { key: 'tact34', label: 'TACT 3/4', slots: 4 },
  { key: 'airSol', label: 'AIR/SOL', slots: 1 },
  { key: 'crm', label: 'CRM', slots: 1 }
];

const DEFAULT_TAB_OPTIONS: Array<{ value: OperationalTabId; label: string }> = [
  { value: 'moyens', label: 'Moyens' },
  { value: 'message', label: 'Messages' },
  { value: 'soiec', label: 'SOIEC / SAOIECL' },
  { value: 'oct', label: 'OCT' },
  { value: 'sitac', label: 'SITAC' },
  { value: 'aide', label: 'Aide opérationnelle' }
];

const formatProxySourceLabel = (source: 'settings' | 'env' | 'missing') => {
  if (source === 'settings') return 'Settings';
  if (source === 'env') return 'Environnement';
  return 'Non configuré';
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
  return buildDoctrineMeans().map((entry) => ({
    id: createMeanId(),
    name: entry.name,
    category: entry.category,
    fullName: entry.fullName,
    capabilities: entry.capabilities,
    isGroup: entry.isGroup
  }));
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
  const { settings: appSettings, updateSettings: updateAppSettings } = useAppSettings();
  const doctrineCategories = useMemo(() => getDoctrineCategories(), []);
  const categoryOptions = useMemo(() => {
    const byKey = new Map(doctrineCategories.map((category) => [category.key, category]));
    (settings.meansCatalog || []).forEach((item) => {
      const key = item.category.trim();
      if (!key || byKey.has(key)) return;
      byKey.set(key, { key, label: key });
    });
    return Array.from(byKey.values());
  }, [doctrineCategories, settings.meansCatalog]);

  const [meanDraft, setMeanDraft] = useState<{ name: string; category: string }>({
    name: '',
    category: doctrineCategories[0]?.key || 'incendie'
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
  const [aiProxyDraft, setAiProxyDraft] = useState(() => appSettings.openaiProxyUrlOverride || '');
  const [aiProxyStatus, setAiProxyStatus] = useState<'idle' | 'checking' | 'ready' | 'error'>('idle');
  const [aiProxyHealth, setAiProxyHealth] = useState<OpenAIProxyHealth | null>(null);

  const aiProxyConfig = useMemo(
    () => getOpenAIProxyConfig({ overrideUrl: appSettings.openaiProxyUrlOverride }),
    [appSettings.openaiProxyUrlOverride]
  );

  const meansCatalog = useMemo(() => settings.meansCatalog || [], [settings.meansCatalog]);
  const messageDemandeOptions = settings.messageDemandeOptions || [];
  const messageSurLesLieuxOptions = settings.messageSurLesLieuxOptions || [];
  const sortedMeansCatalog = useMemo(() => {
    const order = categoryOptions.map((cat) => cat.key);
    return [...meansCatalog].sort((a, b) => {
      const aIndex = order.indexOf(a.category);
      const bIndex = order.indexOf(b.category);
      if (aIndex !== bIndex) return (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex);
      return a.name.localeCompare(b.name);
    });
  }, [categoryOptions, meansCatalog]);

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
    setAiProxyDraft(appSettings.openaiProxyUrlOverride || '');
  }, [appSettings.openaiProxyUrlOverride]);

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

  const handleEditMean = (item: { id: string; name: string; category: string }) => {
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

  const handleSaveAiProxyUrl = () => {
    updateAppSettings((prev) => ({
      ...prev,
      openaiProxyUrlOverride: aiProxyDraft.trim()
    }));
    setAiProxyHealth(null);
    setAiProxyStatus('idle');
  };

  const handleClearAiProxyUrl = () => {
    setAiProxyDraft('');
    updateAppSettings((prev) => ({
      ...prev,
      openaiProxyUrlOverride: ''
    }));
    setAiProxyHealth(null);
    setAiProxyStatus('idle');
  };

  const handleCheckAiProxy = useCallback(async () => {
    setAiProxyStatus('checking');
    const result = await checkOpenAIProxyHealth({ overrideUrl: aiProxyDraft.trim() });
    setAiProxyHealth(result);
    setAiProxyStatus(result.ok ? 'ready' : 'error');
  }, [aiProxyDraft]);

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
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl btn-success text-sm font-semibold shadow-sm transition disabled:opacity-60"
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

          {/* Préférences */}
          <div className="bg-white/80 border border-slate-200 dark:bg-[#151515] dark:border-white/10 rounded-2xl transition-all duration-300 hover:border-slate-300 dark:hover:border-white/20">
            <button
              type="button"
              onClick={() => toggleSection('preferences')}
              aria-expanded={Boolean(openSections.preferences)}
              className="w-full px-6 py-4 flex items-center justify-between gap-4 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-200/60 dark:bg-white/10 rounded-lg">
                  <Sliders className="w-5 h-5 text-slate-600 dark:text-gray-300" />
                </div>
                <div>
                  <div className="font-medium text-lg">Préférences</div>
                  <div className="text-xs text-slate-500 dark:text-gray-400">
                    Choisissez l’onglet affiché par défaut dans l’espace opérationnel.
                  </div>
                </div>
              </div>
              {openSections.preferences ? (
                <ChevronUp className="w-5 h-5 text-slate-500 dark:text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-500 dark:text-gray-400" />
              )}
            </button>

            {openSections.preferences && (
              <div className="px-6 pb-6 space-y-3">
                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-wide text-slate-500 dark:text-gray-400">Onglet par défaut</label>
                  <select
                    value={appSettings.defaultOperationalTab}
                    onChange={(e) => {
                      const nextValue = e.target.value as OperationalTabId;
                      updateAppSettings((prev) => ({ ...prev, defaultOperationalTab: nextValue }));
                    }}
                    className="w-full bg-slate-100 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-slate-800 dark:text-gray-200 focus:outline-none focus:border-slate-400/50 focus:ring-1 focus:ring-slate-400/20 text-sm"
                  >
                    {DEFAULT_TAB_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-slate-500 dark:text-gray-400">
                  Préférence enregistrée sur l’appareil.
                </p>
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
                      onChange={(e) => setMeanDraft((prev) => ({ ...prev, category: e.target.value }))}
                      className="w-full bg-slate-100 dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-slate-800 dark:text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 text-sm"
                    >
                      {categoryOptions.map((cat) => (
                        <option key={cat.key} value={cat.key}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleSaveMean}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl btn-success text-sm font-semibold shadow-sm transition"
                  >
                    <Plus className="w-4 h-4" />
                    {editingMeanId ? 'Mettre à jour' : 'Ajouter'}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleLoadDefaultMeans}
                    className="px-3 py-2 rounded-xl text-xs font-semibold btn-neutral transition"
                  >
                    Charger les moyens standards
                  </button>
                  <button
                    onClick={handleClearMeans}
                    className="px-3 py-2 rounded-xl text-xs font-semibold btn-danger transition"
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
                      const categoryLabel = categoryOptions.find((cat) => cat.key === item.category)?.label || item.category;
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
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl btn-success text-sm font-semibold shadow-sm transition"
                  >
                    <Plus className="w-4 h-4" />
                    {editingDemandeId ? 'Mettre à jour' : 'Ajouter'}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleResetDemandeOptions}
                    className="px-3 py-2 rounded-xl text-xs font-semibold btn-danger transition"
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
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl btn-success text-sm font-semibold shadow-sm transition"
                  >
                    <Plus className="w-4 h-4" />
                    {editingSurLesLieuxId ? 'Mettre à jour' : 'Ajouter'}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleResetSurLesLieuxOptions}
                    className="px-3 py-2 rounded-xl text-xs font-semibold btn-danger transition"
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
                    className="px-3 py-2 rounded-xl text-xs font-semibold btn-danger transition"
                  >
                    Réinitialiser
                  </button>
                  <button
                    onClick={handleValidateOctDefaults}
                    disabled={!isOctDefaultsDirty}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                      isOctDefaultsDirty
                        ? 'btn-success'
                        : 'bg-slate-200 border-slate-200 text-slate-400 cursor-not-allowed dark:bg-white/5 dark:border-white/5 dark:text-gray-500'
                    }`}
                  >
                    Valider
                  </button>
                </div>
              </div>
            )}
          </div>

          <InterventionHistorySection
            defaultCommandLevel={profile?.employment_level}
            isOpen={Boolean(openSections['intervention-history'])}
            messageDemandeOptions={messageDemandeOptions}
            messageSurLesLieuxOptions={messageSurLesLieuxOptions}
            onToggle={() => toggleSection('intervention-history')}
            userId={user?.id}
          />

          <div className="bg-white/80 border border-slate-200 dark:bg-[#151515] dark:border-white/10 rounded-2xl overflow-hidden transition-all duration-300 hover:border-slate-300 dark:hover:border-white/20">
            <button
              type="button"
              onClick={() => toggleSection('assistant-ia')}
              className="w-full px-6 py-4 flex items-center justify-between bg-slate-100/80 hover:bg-slate-200/80 dark:bg-white/5 dark:hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-100 dark:bg-cyan-500/20 rounded-lg">
                  <Bot className="w-5 h-5 text-cyan-700 dark:text-cyan-300" />
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-lg">Assistant IA</span>
                  <span className={`text-[11px] px-2 py-1 rounded-full border ${
                    aiProxyConfig.url
                      ? 'border-emerald-200 text-emerald-700 bg-emerald-50 dark:border-emerald-500/30 dark:text-emerald-300 dark:bg-emerald-500/10'
                      : 'border-amber-200 text-amber-700 bg-amber-50 dark:border-amber-500/30 dark:text-amber-300 dark:bg-amber-500/10'
                  }`}>
                    {aiProxyConfig.url ? 'Proxy configuré' : 'Proxy manquant'}
                  </span>
                </div>
              </div>
              {openSections['assistant-ia'] ? (
                <ChevronUp className="w-5 h-5 text-slate-500 dark:text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-500 dark:text-gray-400" />
              )}
            </button>

            {openSections['assistant-ia'] && (
              <div className="px-6 py-5 space-y-5 bg-slate-50/80 dark:bg-[#0A0A0A]/50">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3">
                    <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">Source active</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{formatProxySourceLabel(aiProxyConfig.source)}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3">
                    <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">URL effective</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white break-all">{aiProxyConfig.url || 'Aucune URL résolue'}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3">
                    <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-gray-400">Env VITE_OPENAI_PROXY_URL</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white break-all">{aiProxyConfig.envUrl || 'Non définie'}</div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                    <Link2 className="w-4 h-4 text-slate-500 dark:text-gray-400" />
                    URL du proxy IA
                  </div>
                  <input
                    type="url"
                    value={aiProxyDraft}
                    onChange={(event) => setAiProxyDraft(event.target.value)}
                    placeholder="http://127.0.0.1:8787/analyze"
                    className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#101010] px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleSaveAiProxyUrl}
                      className="px-4 py-2 rounded-xl text-sm font-semibold btn-neutral"
                    >
                      Enregistrer l’URL
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAiProxyUrl}
                      className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/10 transition-colors"
                    >
                      Effacer l’override
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCheckAiProxy()}
                      disabled={aiProxyStatus === 'checking'}
                      className="px-4 py-2 rounded-xl text-sm font-semibold border border-cyan-300 text-cyan-700 hover:bg-cyan-50 disabled:opacity-60 disabled:cursor-not-allowed dark:border-cyan-500/30 dark:text-cyan-300 dark:hover:bg-cyan-500/10 transition-colors inline-flex items-center gap-2"
                    >
                      <RefreshCw className={`w-4 h-4 ${aiProxyStatus === 'checking' ? 'animate-spin' : ''}`} />
                      Tester la connexion
                    </button>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-gray-400">
                    L’override Settings est prioritaire sur `VITE_OPENAI_PROXY_URL`. Cela permet de rebrancher l’assistant sans rebuild.
                  </div>
                </div>

                {aiProxyHealth && (
                  <div className={`rounded-2xl border px-4 py-4 ${
                    aiProxyHealth.ok
                      ? 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-500/30 dark:bg-emerald-500/10'
                      : 'border-amber-200 bg-amber-50/80 dark:border-amber-500/30 dark:bg-amber-500/10'
                  }`}>
                    <div className="flex items-start gap-3">
                      {aiProxyHealth.ok ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-300 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-300 mt-0.5" />
                      )}
                      <div className="space-y-2 min-w-0">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                          {aiProxyHealth.ok ? 'Proxy joignable' : 'Diagnostic proxy'}
                        </div>
                        <div className="text-sm text-slate-700 dark:text-gray-200">{aiProxyHealth.message}</div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="px-2 py-1 rounded-full bg-white/80 border border-black/5 dark:bg-black/20 dark:border-white/10">
                            Source: {formatProxySourceLabel(aiProxyHealth.source)}
                          </span>
                          <span className="px-2 py-1 rounded-full bg-white/80 border border-black/5 dark:bg-black/20 dark:border-white/10">
                            HTTP: {aiProxyHealth.status ?? 'n/a'}{aiProxyHealth.statusText ? ` ${aiProxyHealth.statusText}` : ''}
                          </span>
                          <span className="px-2 py-1 rounded-full bg-white/80 border border-black/5 dark:bg-black/20 dark:border-white/10">
                            Token Supabase: {aiProxyHealth.hasAuthToken ? 'présent' : 'absent'}
                          </span>
                          <span className="px-2 py-1 rounded-full bg-white/80 border border-black/5 dark:bg-black/20 dark:border-white/10">
                            Réseau: {aiProxyHealth.reachable ? 'joignable' : 'échec'}
                          </span>
                        </div>
                        {aiProxyHealth.url && (
                          <div className="text-xs text-slate-500 dark:text-gray-400 break-all">
                            {aiProxyHealth.url}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-dashed border-slate-300 dark:border-white/10 px-4 py-3 text-xs text-slate-600 dark:text-gray-300 space-y-1">
                  <div>Local recommandé: lancer `npm run ai-proxy:dev`, puis utiliser `http://127.0.0.1:8787/analyze`.</div>
                  <div>Le point de santé répond sur `http://127.0.0.1:8787/health`.</div>
                </div>
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
