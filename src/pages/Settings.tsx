import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Info, Bell, Shield, LogOut, Sun, Plus, Trash2 } from 'lucide-react';
import { RELEASE_NOTES } from '../constants/releaseNotes';
import { useAuth } from '../contexts/AuthContext';
import { APP_NAME, APP_VERSION } from '../constants/appInfo';
import ThemeSelector from '../components/ThemeSelector';
import { useTheme } from '../contexts/ThemeContext';
import { DOCTRINE_CONTEXT } from '../constants/doctrine';
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
  const { logout } = useAuth();
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

  const meansCatalog = settings.meansCatalog || [];
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

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

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
