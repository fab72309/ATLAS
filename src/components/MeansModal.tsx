import React from 'react';
import { ArrowRight, Check, CheckCircle2, ChevronDown, Clock, Filter, MapPin, Plus, Trash2, X } from 'lucide-react';
import { useSessionSettings } from '../utils/sessionSettings';
import { OctColor, OctTreeNode, useOctTree } from '../utils/octTreeStore';
import { readUserScopedJSON, writeUserScopedJSON } from '../utils/userStorage';
import type { MeanItem } from '../types/means';
import { generateMeanId } from '../utils/means';
import { buildDoctrineMeans, getDoctrineCategories } from '../utils/meansCatalog';

interface MeansModalProps {
  isOpen?: boolean;
  inline?: boolean;
  onClose?: () => void;
  selected: MeanItem[];
  onChange: (items: MeanItem[]) => void;
}

const DEFAULT_SECTOR_LABELS = ['SECTEUR 1', 'SECTEUR 2'];
const SECTOR_VALIDATION_KEY = 'atlas-oct-sector-validation';
type CategoryStyle = {
  label: string;
  color: string;
  fill: string;
  statusClass: string;
  dashedClass: string;
};

const CATEGORY_STYLES: Record<string, Omit<CategoryStyle, 'label'>> = {
  incendie: {
    color: 'border-red-300/70 bg-red-50 text-red-700 dark:border-red-500/60 dark:bg-red-500/10 dark:text-red-200',
    fill: 'bg-red-50/80 dark:bg-red-500/10',
    statusClass: 'outline-red-400',
    dashedClass: 'border-red-300/70 dark:border-red-400/80'
  },
  alimentation: {
    color: 'border-blue-300/70 bg-blue-50 text-blue-700 dark:border-blue-500/60 dark:bg-blue-500/10 dark:text-blue-200',
    fill: 'bg-blue-50/80 dark:bg-blue-500/10',
    statusClass: 'outline-blue-400',
    dashedClass: 'border-blue-300/70 dark:border-blue-400/80'
  },
  suap: {
    color: 'border-green-300/70 bg-green-50 text-green-700 dark:border-green-500/60 dark:bg-green-500/10 dark:text-green-200',
    fill: 'bg-green-50/80 dark:bg-green-500/10',
    statusClass: 'outline-green-400',
    dashedClass: 'border-green-300/70 dark:border-green-400/80'
  },
  soutien: {
    color: 'border-orange-300/70 bg-orange-50 text-orange-700 dark:border-orange-400/60 dark:bg-orange-500/10 dark:text-orange-200',
    fill: 'bg-orange-50/80 dark:bg-orange-500/10',
    statusClass: 'outline-orange-400',
    dashedClass: 'border-orange-300/70 dark:border-orange-400/80'
  },
  specialistes: {
    color: 'border-cyan-300/70 bg-cyan-50 text-cyan-700 dark:border-cyan-500/60 dark:bg-cyan-500/10 dark:text-cyan-200',
    fill: 'bg-cyan-50/80 dark:bg-cyan-500/10',
    statusClass: 'outline-cyan-400',
    dashedClass: 'border-cyan-300/70 dark:border-cyan-400/80'
  },
  commandement: {
    color: 'border-purple-300/70 bg-purple-50 text-purple-700 dark:border-purple-500/60 dark:bg-purple-500/10 dark:text-purple-200',
    fill: 'bg-purple-50/80 dark:bg-purple-500/10',
    statusClass: 'outline-purple-400',
    dashedClass: 'border-purple-300/70 dark:border-purple-400/80'
  },
  exterieurs: {
    color: 'border-slate-300/70 bg-slate-50 text-slate-700 dark:border-slate-500/50 dark:bg-slate-500/10 dark:text-slate-200',
    fill: 'bg-slate-50/80 dark:bg-slate-500/10',
    statusClass: 'outline-slate-400',
    dashedClass: 'border-slate-300/70 dark:border-slate-400/80'
  }
};

const getCategoryStyle = (key: string, label: string): CategoryStyle => {
  const style = CATEGORY_STYLES[key] || {
    color: 'border-slate-300/70 bg-slate-50 text-slate-700 dark:border-slate-500/50 dark:bg-slate-500/10 dark:text-slate-200',
    fill: 'bg-slate-50/80 dark:bg-slate-500/10',
    statusClass: 'outline-slate-400',
    dashedClass: 'border-slate-300/70 dark:border-slate-400/80'
  };
  return { label, ...style };
};

const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `node-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const findNodeById = (node: OctTreeNode, id: string): OctTreeNode | null => {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
};

const findFirstCos = (node: OctTreeNode): OctTreeNode | null => {
  if (node.type === 'cos') return node;
  for (const child of node.children) {
    const found = findFirstCos(child);
    if (found) return found;
  }
  return null;
};

const addChildToTree = (node: OctTreeNode, parentId: string, child: OctTreeNode): OctTreeNode => {
  if (node.id === parentId) {
    return { ...node, children: [...node.children, child] };
  }
  return { ...node, children: node.children.map((c) => addChildToTree(c, parentId, child)) };
};

const removeNodeById = (node: OctTreeNode, id: string): OctTreeNode => {
  return {
    ...node,
    children: node.children
      .filter((child) => child.id !== id)
      .map((child) => removeNodeById(child, id))
  };
};

const removeMeanByRef = (node: OctTreeNode, meanRef: string): OctTreeNode => {
  return {
    ...node,
    children: node.children
      .filter((child) => !(child.meanSource === 'means' && child.meanRef === meanRef))
      .map((child) => removeMeanByRef(child, meanRef))
  };
};

const updateNodeById = (node: OctTreeNode, id: string, updater: (n: OctTreeNode) => OctTreeNode): OctTreeNode => {
  if (node.id === id) return updater(node);
  return { ...node, children: node.children.map((c) => updateNodeById(c, id, updater)) };
};

const meanExistsInTree = (node: OctTreeNode, meanRef: string): boolean => {
  if (node.meanSource === 'means' && node.meanRef === meanRef) return true;
  return node.children.some((child) => meanExistsInTree(child, meanRef));
};

const MeansModal: React.FC<MeansModalProps> = ({ isOpen = true, inline = false, onClose, selected, onChange }) => {
  const { tree: octTree, setTree: setOctTree } = useOctTree();
  const { settings } = useSessionSettings();
  const [assignSelection, setAssignSelection] = React.useState<Record<string, string>>({});
  const [sectorDrafts, setSectorDrafts] = React.useState<Record<string, string>>({});
  const [subsectorOpen, setSubsectorOpen] = React.useState<Record<string, boolean>>({});
  const [selectionFilters, setSelectionFilters] = React.useState({
    requested: false,
    onSite: false,
    toAssign: false,
    assigned: false
  });
  const [collapsedCategories, setCollapsedCategories] = React.useState<Record<string, boolean>>({});
  const [isFilterOpen, setIsFilterOpen] = React.useState(false);
  const [openInfoCard, setOpenInfoCard] = React.useState<string | null>(null);
  const [sectorValidated, setSectorValidated] = React.useState<Record<string, boolean>>(() => {
    try {
      const parsed = readUserScopedJSON<Record<string, boolean>>(SECTOR_VALIDATION_KEY, 'local');
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (err) {
      console.error('OCT sector validation read error', err);
    }
    return {};
  });

  const persistSectorValidation = React.useCallback((state: Record<string, boolean>) => {
    try {
      writeUserScopedJSON(SECTOR_VALIDATION_KEY, state, 'local');
    } catch (err) {
      console.error('OCT sector validation write error', err);
    }
  }, []);

  const activeFiltersCount = Object.values(selectionFilters).filter(Boolean).length;
  const hasActiveFilters = activeFiltersCount > 0;
  const resetSelectionFilters = () => {
    setSelectionFilters({ requested: false, onSite: false, toAssign: false, assigned: false });
  };
  const filteredSelected = React.useMemo(() => {
    if (!hasActiveFilters) return selected;
    return selected.filter((s) => {
      const isRequested = s.status === 'demande';
      const isOnSite = s.status === 'sur_place';
      const isAssigned = octTree ? meanExistsInTree(octTree, s.id) : false;
      const isToAssign = !isAssigned;
      return (
        (selectionFilters.requested && isRequested)
        || (selectionFilters.onSite && isOnSite)
        || (selectionFilters.toAssign && isToAssign)
        || (selectionFilters.assigned && isAssigned)
      );
    });
  }, [hasActiveFilters, selected, selectionFilters, octTree]);

  const toggleCategory = React.useCallback((key: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  React.useEffect(() => {
    const needsIds = selected.some((s) => !s.id);
    if (needsIds) {
      const withIds = selected.map((s) => (s.id ? s : { ...s, id: generateMeanId() }));
      onChange(withIds);
    }
  }, [selected, onChange]);

  const doctrineCategories = React.useMemo(() => getDoctrineCategories(), []);

  const meansList = React.useMemo(() => {
    const merged = new Map<string, {
      name: string;
      category: string;
      fullName?: string;
      capabilities?: string;
      isGroup?: boolean;
    }>();

    const sourceMeans = settings.meansCatalog.length > 0
      ? settings.meansCatalog
      : buildDoctrineMeans();

    sourceMeans.forEach((item) => {
      const trimmed = item.name.trim();
      if (!trimmed) return;
      merged.set(`${item.category}:${trimmed.toLowerCase()}`, {
        name: trimmed,
        category: item.category,
        fullName: item.fullName,
        capabilities: item.capabilities,
        isGroup: item.isGroup
      });
    });

    return Array.from(merged.values());
  }, [settings.meansCatalog]);

  const categories = React.useMemo(() => {
    const labelByKey = new Map(doctrineCategories.map((category) => [category.key, category.label]));
    const customKeys = Array.from(new Set(settings.meansCatalog.map((item) => item.category.trim()).filter(Boolean)))
      .filter((key) => !labelByKey.has(key))
      .map((key) => ({ key, label: key }));
    return [...doctrineCategories, ...customKeys].map((category) => ({
      ...getCategoryStyle(category.key, category.label),
      key: category.key
    }));
  }, [doctrineCategories, settings.meansCatalog]);

  const meansByCategory = React.useMemo(() => {
    const grouped: Record<string, typeof meansList> = {};
    meansList.forEach((item) => {
      if (!item.name) return;
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    });
    return grouped;
  }, [meansList]);

  const getDefaultFrequencies = React.useCallback(
    (type: 'sector' | 'subsector' | 'engine') => {
      const defaults = settings.octDefaults?.[type];
      const up = defaults?.up?.trim() || '';
      const down = defaults?.down?.trim() || '';
      return [up, down].filter(Boolean);
    },
    [settings.octDefaults]
  );

  const updateOctTree = React.useCallback(
    (updater: (tree: OctTreeNode) => OctTreeNode) => setOctTree(updater),
    [setOctTree]
  );

  const cosNode = React.useMemo(() => (octTree ? findFirstCos(octTree) : null), [octTree]);
  const sectors = React.useMemo(
    () => (cosNode ? cosNode.children.filter((c) => c.type === 'sector') : []),
    [cosNode]
  );
  const assignableNodes = React.useMemo(() => {
    const nodes: { id: string; label: string }[] = [];
    sectors.forEach((s) => {
      nodes.push({ id: s.id, label: sectorDrafts[s.id] || s.label || 'Secteur' });
      s.children
        .filter((c) => c.type === 'subsector')
        .forEach((sub) => nodes.push({ id: sub.id, label: `${sub.label || 'Sous-secteur'} (${sectorDrafts[s.id] || s.label || 'Secteur'})` }));
    });
    return nodes;
  }, [sectors, sectorDrafts]);

  React.useEffect(() => {
    setSectorDrafts((prev) => {
      const next: Record<string, string> = {};
      sectors.forEach((s) => {
        next[s.id] = prev[s.id] ?? s.label ?? '';
      });
      return next;
    });
    setSubsectorOpen((prev) => {
      const next: Record<string, boolean> = {};
      sectors.forEach((s) => {
        next[s.id] = prev[s.id] ?? false;
      });
      return next;
    });
    setSectorValidated((prev) => {
      const next: Record<string, boolean> = {};
      sectors.forEach((s) => {
        next[s.id] = prev[s.id] ?? false;
      });
      return next;
    });
  }, [sectors]);

  React.useEffect(() => {
    persistSectorValidation(sectorValidated);
  }, [sectorValidated, persistSectorValidation]);

  const handleAddSector = () => {
    updateOctTree((tree) => {
      const cos = findFirstCos(tree) || tree;
      const newSector: OctTreeNode = {
        id: generateId(),
        type: 'sector',
        label: 'Nouveau secteur',
        frequencies: getDefaultFrequencies('sector'),
        color: 'red',
        children: []
      };
      return addChildToTree(tree, cos.id, newSector);
    });
  };

  const handleAddSubsector = (sectorId: string) => {
    updateOctTree((tree) => {
      const newSubsector: OctTreeNode = {
        id: generateId(),
        type: 'subsector',
        label: 'Nouveau sous-secteur',
        frequencies: getDefaultFrequencies('subsector'),
        color: 'orange',
        children: []
      };
      return addChildToTree(tree, sectorId, newSubsector);
    });
  };

  const handleRenameNode = (nodeId: string, label: string) => {
    updateOctTree((tree) => updateNodeById(tree, nodeId, (n) => ({ ...n, label: label.trim() || n.label })));
  };

  const handleDeleteNode = (nodeId: string) => {
    if (!octTree) return;
    const target = findNodeById(octTree, nodeId);
    if (!target || target.type === 'codis' || target.type === 'cos') return;
    updateOctTree((tree) => removeNodeById(tree, nodeId));
    setSectorValidated((prev) => {
      if (!(nodeId in prev)) return prev;
      const next = { ...prev };
      delete next[nodeId];
      return next;
    });
  };

  const handleAssignMean = (mean: MeanItem) => {
    if (!octTree || !assignableNodes.length) return;
    const targetId = assignSelection[mean.id] || assignableNodes[0].id;
    const targetNode = findNodeById(octTree, targetId);
    if (!targetNode || (targetNode.type !== 'sector' && targetNode.type !== 'subsector')) return;
    updateOctTree((tree) => {
      if (meanExistsInTree(tree, mean.id)) return tree;
      const runtimeTarget = findNodeById(tree, targetId);
      const inheritedColor = (runtimeTarget?.color as OctColor) || 'orange';
      const newEngine: OctTreeNode = {
        id: generateId(),
        type: 'engine',
        label: mean.name,
        frequencies: getDefaultFrequencies('engine'),
        meanSource: 'means',
        meanRef: mean.id,
        meanStatus: mean.status,
        meanCategory: mean.category,
        color: inheritedColor,
        children: []
      };
      return addChildToTree(tree, targetId, newEngine);
    });
  };

  const addMean = (item: { name: string; category?: string }) => {
    const next: MeanItem = { id: generateMeanId(), name: item.name, status: 'sur_place', category: item.category };
    onChange([...selected, next]);
  };

  const remove = (id: string) => {
    if (typeof window !== 'undefined' && !window.confirm('Supprimer ce moyen de la sélection ?')) return;
    onChange(selected.filter((s) => s.id !== id));
    if (octTree) {
      setOctTree((tree) => removeMeanByRef(tree, id));
    }
    setAssignSelection((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const toggleStatus = (id: string) => {
    onChange(
      selected.map((s) =>
        s.id === id
          ? { ...s, status: s.status === 'sur_place' ? 'demande' : 'sur_place' }
          : s
      )
    );
  };

  if (!isOpen && !inline) return null;

  const content = (
    <div className="flex flex-1 flex-col gap-5 overflow-hidden p-4">
      <div className="flex flex-1 flex-col gap-5 overflow-hidden md:flex-row">
        <div className="flex w-full min-w-0 flex-col gap-5 md:w-[28rem] md:flex-none xl:w-[30rem]">
          <div className="w-full overflow-y-auto rounded-3xl border border-slate-200/80 bg-white/88 p-5 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.28)] dark:border-white/10 dark:bg-white/5 dark:shadow-none">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-slate-800 dark:text-gray-200">Sélection</h4>
              <button
                onClick={() => setIsFilterOpen(true)}
                className="text-[11px] px-2 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 hover:text-slate-900 hover:border-slate-300 dark:bg-white/5 dark:border-white/10 dark:text-gray-200 transition flex items-center gap-1"
              >
                <Filter className="w-3 h-3" />
                Filtrer
                {hasActiveFilters && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
                    {activeFiltersCount}
                  </span>
                )}
              </button>
            </div>
            {selected.length === 0 && <div className="pt-2 text-sm text-slate-500 dark:text-gray-500">Aucun moyen sélectionné.</div>}
            <div className="space-y-3 pt-3">
              {filteredSelected.length === 0 && selected.length > 0 && (
                <div className="text-slate-500 dark:text-gray-500 text-sm">Aucun moyen pour ces filtres.</div>
              )}
              {filteredSelected.map((s) => {
                const colorMeta = (s.category ? categories.find((category) => category.key === s.category) : undefined) || {
                  statusClass: 'outline-slate-300',
                  color: 'border-slate-200 bg-white text-slate-700 dark:border-white/20 dark:bg-white/5 dark:text-white',
                  fill: 'bg-slate-50/80 dark:bg-white/5',
                  dashedClass: 'border-yellow-300/70 dark:border-yellow-400/80'
                };
                const isRequested = s.status === 'demande';
                const alreadyInOct = octTree ? meanExistsInTree(octTree, s.id) : false;
                const isAssigned = alreadyInOct;
                return (
                  <div
                    key={s.id}
                    className={`space-y-2 rounded-2xl border p-3 ${isRequested ? `border-dashed ${colorMeta.dashedClass || 'border-yellow-300/70 dark:border-yellow-400/80'}` : colorMeta.color || 'border-slate-200'} ${colorMeta.fill || 'bg-slate-50/80'} shadow-sm`}
                  >
                    <div className="space-y-2">
                      <div className="min-w-0 text-sm font-semibold text-slate-800 dark:text-gray-100">{s.name}</div>
                      <div className="inline-grid w-full sm:w-auto grid-cols-1 items-center gap-1.5 sm:grid-cols-[14rem_auto_auto]">
                        <div className="relative w-full">
                          <select
                            value={assignSelection[s.id] || assignableNodes[0]?.id || ''}
                            onChange={(e) => setAssignSelection((prev) => ({ ...prev, [s.id]: e.target.value }))}
                            className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200/80 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:focus:ring-white/20"
                            disabled={!assignableNodes.length}
                          >
                            {!assignableNodes.length && <option value="">Aucun secteur disponible</option>}
                            {assignableNodes.map((node) => (
                              <option key={node.id} value={node.id}>{node.label}</option>
                            ))}
                          </select>
                        </div>
                        <button
                          onClick={() => handleAssignMean(s)}
                          disabled={!assignableNodes.length || isAssigned || alreadyInOct}
                          className={`h-9 px-2.5 rounded-md border text-[11px] font-semibold text-white transition ${
                            isAssigned
                              ? 'bg-emerald-500 border-emerald-300/70 text-emerald-50'
                              : 'bg-amber-500 border-amber-300/70 text-amber-50 hover:bg-amber-400'
                          } ${(!assignableNodes.length || alreadyInOct) ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          {isAssigned ? 'Affecté' : 'À affecter'}
                        </button>
                        <button
                          onClick={() => remove(s.id)}
                          className="p-1.5 rounded-md border border-slate-200 bg-white text-red-600 transition hover:bg-red-50 dark:border-white/10 dark:bg-white/5 dark:text-red-300 dark:hover:bg-red-500/20"
                          title="Retirer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <div
                        className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1 dark:border-white/10 dark:bg-white/5"
                        role="radiogroup"
                        aria-label={`Statut de ${s.name}`}
                      >
                        <button
                          type="button"
                          role="radio"
                          aria-checked={!isRequested}
                          onClick={() => {
                            if (isRequested) toggleStatus(s.id);
                          }}
                          className={`inline-flex items-center gap-2 rounded-md px-2 py-1 text-[12px] font-medium transition ${
                            !isRequested
                              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30'
                              : 'text-slate-600 hover:bg-slate-50 dark:text-gray-300 dark:hover:bg-white/5'
                          }`}
                        >
                          <span
                            className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border ${
                              !isRequested
                                ? 'border-emerald-600 dark:border-emerald-400'
                                : 'border-slate-300 dark:border-white/20'
                            }`}
                          >
                            {!isRequested && <span className="h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />}
                          </span>
                          Sur place
                        </button>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={isRequested}
                          onClick={() => {
                            if (!isRequested) toggleStatus(s.id);
                          }}
                          className={`inline-flex items-center gap-2 rounded-md px-2 py-1 text-[12px] font-medium transition ${
                            isRequested
                              ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30'
                              : 'text-slate-600 hover:bg-slate-50 dark:text-gray-300 dark:hover:bg-white/5'
                          }`}
                        >
                          <span
                            className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border ${
                              isRequested
                                ? 'border-amber-600 dark:border-amber-400'
                                : 'border-slate-300 dark:border-white/20'
                            }`}
                          >
                            {isRequested && <span className="h-2 w-2 rounded-full bg-amber-600 dark:bg-amber-400" />}
                          </span>
                          Demandé
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {isFilterOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <button
                  className="absolute inset-0 bg-black/40"
                  onClick={() => setIsFilterOpen(false)}
                  aria-label="Fermer les filtres"
                />
                <div className="relative w-full max-w-xs rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0f121a] shadow-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <Filter className="w-4 h-4" />
                      Filtres
                    </div>
                    <button
                      onClick={() => setIsFilterOpen(false)}
                      className="text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="space-y-2 text-sm">
                    <label className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 px-3 py-2">
                      <div className="flex items-center gap-2 text-slate-700 dark:text-gray-200">
                        <Clock className="w-4 h-4 text-amber-500" />
                        Demandé
                      </div>
                      <input
                        type="checkbox"
                        checked={selectionFilters.requested}
                        onChange={() => setSelectionFilters((prev) => ({ ...prev, requested: !prev.requested }))}
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 px-3 py-2">
                      <div className="flex items-center gap-2 text-slate-700 dark:text-gray-200">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        Sur place
                      </div>
                      <input
                        type="checkbox"
                        checked={selectionFilters.onSite}
                        onChange={() => setSelectionFilters((prev) => ({ ...prev, onSite: !prev.onSite }))}
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 px-3 py-2">
                      <div className="flex items-center gap-2 text-slate-700 dark:text-gray-200">
                        <ArrowRight className="w-4 h-4 text-blue-500" />
                        À affecter
                      </div>
                      <input
                        type="checkbox"
                        checked={selectionFilters.toAssign}
                        onChange={() => setSelectionFilters((prev) => ({ ...prev, toAssign: !prev.toAssign }))}
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 px-3 py-2">
                      <div className="flex items-center gap-2 text-slate-700 dark:text-gray-200">
                        <MapPin className="w-4 h-4 text-purple-500" />
                        Affectés
                      </div>
                      <input
                        type="checkbox"
                        checked={selectionFilters.assigned}
                        onChange={() => setSelectionFilters((prev) => ({ ...prev, assigned: !prev.assigned }))}
                      />
                    </label>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      onClick={resetSelectionFilters}
                      className="text-[12px] px-3 py-1.5 rounded-lg btn-danger transition"
                    >
                      Réinitialiser
                    </button>
                    <button
                      onClick={() => setIsFilterOpen(false)}
                      className="text-[12px] px-3 py-1.5 rounded-lg btn-neutral transition"
                    >
                      Fermer
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="w-full overflow-y-auto rounded-3xl border border-slate-200/80 bg-white/88 p-5 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.28)] dark:border-white/10 dark:bg-white/5 dark:shadow-none">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-gray-200">Secteurs</h4>
            <button
              onClick={handleAddSector}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-[11px] text-white transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Secteur
            </button>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-gray-400">
            Les secteurs créés ici sont synchronisés automatiquement avec l&apos;onglet OCT.
          </p>
          {!sectors.length && (
            <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 dark:text-gray-400 dark:bg-white/5 dark:border-white/10">
              Aucun secteur pour le moment.
            </div>
          )}
          <div className="space-y-3 pt-3">
          {sectors.map((sector) => {
            const subsectors = sector.children.filter((c) => c.type === 'subsector');
            return (
              <div key={sector.id} className="space-y-2 rounded-2xl border border-slate-200/80 bg-white/72 p-3 dark:border-white/10 dark:bg-black/20">
                  <div className="inline-grid w-full sm:w-auto grid-cols-1 sm:grid-cols-[14rem_auto_auto] items-center gap-1.5">
                    <div className="relative w-full">
                      <input
                        value={sectorDrafts[sector.id] ?? sector.label}
                        onChange={(e) => {
                          const value = e.target.value;
                          setSectorDrafts((prev) => ({ ...prev, [sector.id]: value }));
                          setSectorValidated((prev) => ({ ...prev, [sector.id]: false }));
                        }}
                        className={`w-full px-2 py-1.5 rounded-md bg-white border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200/80 pr-8 dark:bg-white/5 dark:border-white/10 dark:focus:ring-white/20 ${
                          DEFAULT_SECTOR_LABELS.includes((sectorDrafts[sector.id] ?? sector.label ?? '').toUpperCase())
                            ? 'text-slate-400 dark:text-white/60'
                            : 'text-slate-700 dark:text-white'
                        }`}
                        placeholder="Nom du secteur"
                      />
                      {sectorValidated[sector.id] && (
                        <Check className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-400" />
                      )}
                    </div>
                    <button
                      onClick={() => {
                        const label = (sectorDrafts[sector.id] ?? sector.label).trim();
                        handleRenameNode(sector.id, label);
                        setSectorDrafts((prev) => ({ ...prev, [sector.id]: label }));
                        setSectorValidated((prev) => ({ ...prev, [sector.id]: true }));
                      }}
                      className="px-2.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-[11px] text-white border border-emerald-400/40 transition"
                    >
                      {sectorValidated[sector.id] ? 'Mettre à jour' : 'Valider'}
                    </button>
                    <button
                      onClick={() => handleDeleteNode(sector.id)}
                      className="p-1.5 rounded-md bg-white border border-slate-200 text-red-600 hover:bg-red-50 transition dark:bg-white/5 dark:hover:bg-red-500/20 dark:border-white/10 dark:text-red-300"
                      title="Supprimer le secteur"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setSubsectorOpen((prev) => ({ ...prev, [sector.id]: !prev[sector.id] }))}
                      className="w-full sm:col-span-3 flex items-center justify-between px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[10px] text-slate-600 transition dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10 dark:text-gray-200"
                    >
                      <span className="uppercase tracking-wide text-[10px] text-slate-500 dark:text-gray-300">Sous-secteurs</span>
                      <ChevronDown
                        className={`w-3 h-3 text-slate-500 dark:text-gray-300 transition-transform ${subsectorOpen[sector.id] ? 'rotate-180' : 'rotate-0'}`}
                      />
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {subsectorOpen[sector.id] && (
                      <>
                        {!subsectors.length && (
                          <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 dark:text-gray-500 dark:bg-white/5 dark:border-white/10">
                            Aucun sous-secteur.
                          </div>
                        )}
                        {subsectors.map((sub) => (
                          <div key={sub.id} className="flex flex-wrap items-center gap-1.5">
                            <input
                              value={sub.label}
                              onChange={(e) => handleRenameNode(sub.id, e.target.value)}
                              className="w-full sm:w-56 px-2 py-1.5 rounded-md bg-white border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200/80 dark:bg-white/5 dark:border-white/10 dark:text-white dark:focus:ring-white/20"
                              placeholder="Nom du sous-secteur"
                            />
                            <button
                              onClick={() => handleDeleteNode(sub.id)}
                              className="p-1.5 rounded-md bg-white border border-slate-200 text-red-600 hover:bg-red-50 transition dark:bg-white/5 dark:hover:bg-red-500/20 dark:border-white/10 dark:text-red-300"
                              title="Supprimer le sous-secteur"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => handleAddSubsector(sector.id)}
                          className="w-full flex items-center justify-center gap-2 px-2.5 py-1.5 rounded-md bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-200 text-[11px] text-slate-600 transition dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/20 dark:text-gray-200"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Ajouter un sous-secteur
                        </button>
                      </>
                    )}
                </div>
              </div>
            );
          })}
        </div>
          </div>
        </div>

        <div className="w-full min-w-0 flex-1 overflow-y-auto rounded-3xl border border-slate-200/80 bg-white/88 p-5 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.28)] dark:border-white/10 dark:bg-white/5 dark:shadow-none">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-gray-200">Recueil des moyens</h4>
            <span className="text-[11px] text-slate-500 dark:text-gray-400">{meansList.length} disponibles</span>
          </div>
          <div className="space-y-5 pt-4">
          {categories.map(({ key: catKey, ...meta }) => {
            const moyens = meansByCategory[catKey] || [];
            if (!moyens.length) return null;
            const isCollapsed = collapsedCategories[catKey] ?? false;
            return (
              <div key={catKey} className="space-y-2">
                <button
                  type="button"
                  onClick={() => toggleCategory(catKey)}
                  className={`mb-1 inline-flex items-center gap-2 rounded px-2 py-1 text-[11px] font-semibold transition hover:opacity-90 ${meta.color}`}
                  aria-expanded={!isCollapsed}
                >
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isCollapsed ? '-rotate-90' : 'rotate-0'}`} />
                  <span>{meta.label}</span>
                </button>
                {!isCollapsed && (() => {
                  const standalone = moyens.filter((item) => !item.isGroup);
                  const groups = moyens.filter((item) => item.isGroup);
                  const sections = [
                    { id: 'standalone', label: 'Moyens seuls', items: standalone },
                    { id: 'groups', label: 'Groupes constitués', items: groups }
                  ].filter((section) => section.items.length > 0);

                  return sections.map((section) => (
                    <div key={`${catKey}-${section.id}`} className="space-y-2">
                      {sections.length > 1 && (
                        <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-gray-400">
                          {section.label}
                        </div>
                      )}
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                        {section.items.map((m) => {
                          const title = m.name;
                          const already = selected.find((s) => s.name === title);
                          const isRequested = already?.status === 'demande';
                          const infoId = `${catKey}:${section.id}:${title}`;
                          return (
                            <div
                              key={infoId}
                              onClick={() => addMean({ name: title, category: catKey })}
                              className={`relative w-full text-left px-2.5 py-2 rounded-lg border cursor-pointer min-h-[44px] ${already ? `border-dashed ${meta.dashedClass}` : 'border-slate-200 dark:border-white/15'} ${meta.color} hover:bg-slate-100 dark:hover:bg-white/10 transition`}
                            >
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  setOpenInfoCard((prev) => (prev === infoId ? null : infoId));
                                }}
                                className="absolute top-2 right-2 z-10 w-5 h-5 rounded-full border border-current/30 bg-white/70 dark:bg-black/20 flex items-center justify-center text-[12px] font-serif italic leading-none opacity-80 hover:opacity-100"
                                aria-label={`Informations sur ${title}`}
                                title={`Informations sur ${title}`}
                              >
                                i
                              </button>
                              <div className="pr-6">
                                <div className="text-[13px] leading-tight font-medium">{title}</div>
                                {already && <div className="text-[11px] text-slate-500 dark:text-gray-300 mt-0.5">{isRequested ? 'Demandé' : 'Sur place'}</div>}
                              </div>
                              {openInfoCard === infoId && (
                                <div
                                  className="absolute top-8 right-2 z-20 w-72 max-w-[calc(100%-1rem)] rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#10141d] shadow-xl p-3 text-left"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                  }}
                                >
                                  <div className="text-sm font-semibold text-slate-900 dark:text-white">{title}</div>
                                  {m.fullName && (
                                    <div className="mt-1 text-xs text-slate-600 dark:text-gray-300">
                                      {m.fullName}
                                    </div>
                                  )}
                                  <div className="mt-2 text-[11px] leading-relaxed text-slate-600 dark:text-gray-300">
                                    {m.capabilities || 'Aucune capacité renseignée.'}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            );
          })}
          </div>
        </div>
      </div>
    </div>
  );

  if (inline) {
    return (
      <div className="w-full bg-white/80 dark:bg-[#0f121a] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-sm dark:shadow-lg flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/80 dark:border-white/10">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Moyens</h3>
        </div>
        {content}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-white/90 dark:bg-[#0f121a] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/80 dark:border-white/10">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Ajouter des moyens</h3>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        {content}
      </div>
    </div>
  );
};

export default MeansModal;
