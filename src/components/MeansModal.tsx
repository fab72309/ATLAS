import React from 'react';
import { Check, ChevronDown, Plus, Trash2, X } from 'lucide-react';
import { DOCTRINE_CONTEXT } from '../constants/doctrine';
import { useSessionSettings } from '../utils/sessionSettings';
import { OctColor, OctTreeNode, useOctTree } from '../utils/octTreeStore';

type Status = 'sur_place' | 'demande';

export interface MeanItem {
  id: string;
  name: string;
  status: Status;
  category?: string;
}

interface MeansModalProps {
  isOpen?: boolean;
  inline?: boolean;
  onClose?: () => void;
  selected: MeanItem[];
  onChange: (items: MeanItem[]) => void;
}

const DEFAULT_SECTOR_LABELS = ['SECTEUR 1', 'SECTEUR 2'];
const SECTOR_VALIDATION_KEY = 'atlas-oct-sector-validation';
const generateMeanId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `mean-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

type CategoryStyle = {
  label: string;
  key: keyof typeof DOCTRINE_CONTEXT;
  color: string;
  fill: string;
  statusClass: string;
  dashedClass: string;
};

const CATEGORIES: Record<string, CategoryStyle> = {
  incendie: {
    label: 'Incendie',
    key: 'incendie_structure',
    color: 'border-red-300/70 bg-red-50 text-red-700 dark:border-red-500/60 dark:bg-red-500/10 dark:text-red-200',
    fill: 'bg-red-50/80 dark:bg-red-500/10',
    statusClass: 'outline-red-400',
    dashedClass: 'border-red-300/70 dark:border-red-400/80'
  },
  suap: {
    label: 'SUAP',
    key: 'secours_personne_complexe',
    color: 'border-green-300/70 bg-green-50 text-green-700 dark:border-green-500/60 dark:bg-green-500/10 dark:text-green-200',
    fill: 'bg-green-50/80 dark:bg-green-500/10',
    statusClass: 'outline-green-400',
    dashedClass: 'border-green-300/70 dark:border-green-400/80'
  },
  speciaux: {
    label: 'Engins spéciaux',
    key: 'fuite_gaz',
    color: 'border-orange-300/70 bg-orange-50 text-orange-700 dark:border-orange-400/60 dark:bg-orange-500/10 dark:text-orange-200',
    fill: 'bg-orange-50/80 dark:bg-orange-500/10',
    statusClass: 'outline-orange-400',
    dashedClass: 'border-orange-300/70 dark:border-orange-400/80'
  },
  commandement: {
    label: 'Commandement',
    key: 'secours_personne_complexe',
    color: 'border-purple-300/70 bg-purple-50 text-purple-700 dark:border-purple-500/60 dark:bg-purple-500/10 dark:text-purple-200',
    fill: 'bg-purple-50/80 dark:bg-purple-500/10',
    statusClass: 'outline-purple-400',
    dashedClass: 'border-purple-300/70 dark:border-purple-400/80'
  },
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
  const [sectorValidated, setSectorValidated] = React.useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(SECTOR_VALIDATION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed as Record<string, boolean>;
      }
    } catch (err) {
      console.error('OCT sector validation read error', err);
    }
    return {};
  });

  const persistSectorValidation = React.useCallback((state: Record<string, boolean>) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(SECTOR_VALIDATION_KEY, JSON.stringify(state));
    } catch (err) {
      console.error('OCT sector validation write error', err);
    }
  }, []);

  React.useEffect(() => {
    const needsIds = selected.some((s) => !s.id);
    if (needsIds) {
      const withIds = selected.map((s) => (s.id ? s : { ...s, id: generateMeanId() }));
      onChange(withIds);
    }
  }, [selected, onChange]);

  const meansList = React.useMemo(() => {
    const merged = new Map<string, { name: string; category: string }>();
    const addItem = (name: string, category: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      merged.set(`${category}:${trimmed.toLowerCase()}`, { name: trimmed, category });
    };

    Object.entries(CATEGORIES).forEach(([catKey, meta]) => {
      const ctx = DOCTRINE_CONTEXT[meta.key as keyof typeof DOCTRINE_CONTEXT];
      const moyens = ctx?.moyens_standards_td || [];
      moyens.forEach((m: string) => {
        const title = m.split(':')[0].trim();
        addItem(title, catKey);
      });
    });

    settings.meansCatalog.forEach((item) => {
      addItem(item.name, item.category);
    });

    return Array.from(merged.values());
  }, [settings.meansCatalog]);

  const meansByCategory = React.useMemo(() => {
    const grouped: Record<string, { name: string; category: string }[]> = {};
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
      const colorByStatus: Record<'sur_place' | 'demande', OctColor> = { sur_place: 'green', demande: 'orange' };
      const newEngine: OctTreeNode = {
        id: generateId(),
        type: 'engine',
        label: mean.name,
        frequencies: getDefaultFrequencies('engine'),
        meanSource: 'means',
        meanRef: mean.id,
        meanStatus: mean.status,
        meanCategory: mean.category,
        color: colorByStatus[mean.status] || 'orange',
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
    <div className="flex flex-1 flex-col gap-4 overflow-hidden">
      <div className="flex flex-1 flex-col md:flex-row gap-4 overflow-hidden">
        <div className="w-full md:w-1/3 flex flex-col gap-4">
          <div className="w-full border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 space-y-3 overflow-y-auto bg-white/80 dark:bg-white/5 shadow-sm dark:shadow-none">
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
          <div className="space-y-3">
          {sectors.map((sector) => {
            const subsectors = sector.children.filter((c) => c.type === 'subsector');
            return (
              <div key={sector.id} className="rounded-lg border border-slate-200/80 bg-white/70 p-2.5 space-y-2 dark:border-white/10 dark:bg-black/20">
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

          <div className="w-full border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 space-y-3 overflow-y-auto bg-white/80 dark:bg-white/5 shadow-sm dark:shadow-none">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-gray-200">Sélection</h4>
            {selected.length === 0 && <div className="text-slate-500 dark:text-gray-500 text-sm">Aucun moyen sélectionné.</div>}
            <div className="space-y-2">
              {selected.map((s) => {
                const colorMeta = CATEGORIES[s.category || ''] || {
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
                    className={`space-y-2 px-3 py-3 rounded-lg border ${isRequested ? `border-dashed ${colorMeta.dashedClass || 'border-yellow-300/70 dark:border-yellow-400/80'}` : colorMeta.color || 'border-slate-200'} ${colorMeta.fill || 'bg-slate-50/80'} shadow-sm`}
                  >
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <div className="flex-1 text-sm text-slate-800 dark:text-gray-100 font-semibold">{s.name}</div>
                      <select
                        value={assignSelection[s.id] || assignableNodes[0]?.id || ''}
                        onChange={(e) => setAssignSelection((prev) => ({ ...prev, [s.id]: e.target.value }))}
                        className="flex-1 px-3 py-2 rounded-lg bg-white border border-slate-200 text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200/80 dark:bg-white/5 dark:border-white/10 dark:text-gray-200 dark:focus:ring-white/20"
                        disabled={!assignableNodes.length}
                      >
                        {!assignableNodes.length && <option value="">Aucun secteur disponible</option>}
                        {assignableNodes.map((node) => (
                          <option key={node.id} value={node.id}>{node.label}</option>
                        ))}
                      </select>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAssignMean(s)}
                          disabled={!assignableNodes.length || isAssigned || alreadyInOct}
                          className={`px-3 py-2 text-[12px] rounded-lg transition border font-semibold ${
                            isAssigned
                              ? 'bg-emerald-500 border-emerald-300/70 text-emerald-50'
                              : 'bg-amber-500 border-amber-300/70 text-amber-50 hover:bg-amber-400'
                          } ${(!assignableNodes.length || alreadyInOct) ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          {isAssigned ? 'Affecté' : 'À affecter'}
                        </button>
                        <button
                          onClick={() => remove(s.id)}
                          className="p-2 rounded-lg bg-white border border-slate-200 text-red-600 hover:bg-red-50 transition dark:bg-white/5 dark:hover:bg-red-500/20 dark:border-white/10 dark:text-red-300"
                          title="Retirer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleStatus(s.id)}
                        className={`relative w-16 h-8 rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-slate-200/80 dark:focus:ring-white/20 shadow-inner ${isRequested ? 'bg-amber-400/80 border-amber-200/80' : 'bg-emerald-400/80 border-emerald-200/80'}`}
                        aria-label={isRequested ? 'Basculer en sur place' : 'Basculer en demandé'}
                      >
                        <div className={`absolute inset-y-1 left-1 w-6 h-6 rounded-full bg-white shadow-lg transition-transform ${isRequested ? 'translate-x-7' : 'translate-x-0'}`} />
                        {!isRequested && <Check className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-900/90" />}
                      </button>
                      <span className="text-[12px] text-slate-600 dark:text-gray-200">{isRequested ? 'Demandé' : 'Sur place'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="w-full md:flex-1 border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 space-y-4 overflow-y-auto bg-white/80 dark:bg-white/5 shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-gray-200">Recueil des moyens</h4>
            <span className="text-[11px] text-slate-500 dark:text-gray-400">{meansList.length} disponibles</span>
          </div>
          {Object.entries(CATEGORIES).map(([catKey, meta]) => {
            const moyens = meansByCategory[catKey] || [];
            if (!moyens.length) return null;
            return (
              <div key={catKey} className="space-y-2">
                <div className={`text-[11px] font-semibold mb-1 inline-block px-2 py-1 rounded ${meta.color}`}>
                  {meta.label}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                  {moyens.map((m) => {
                    const title = m.name;
                    const already = selected.find((s) => s.name === title);
                    const isRequested = already?.status === 'demande';
                    return (
                      <button
                        key={`${catKey}-${title}`}
                        onClick={() => addMean({ name: title, category: catKey })}
                        className={`w-full text-left px-3 py-2 rounded-lg border ${already ? `border-dashed ${meta.dashedClass}` : 'border-slate-200 dark:border-white/15'} ${meta.color} hover:bg-slate-100 dark:hover:bg-white/10 transition`}
                      >
                        <div className="text-sm leading-tight">{title}</div>
                        {already && <div className="text-[11px] text-slate-500 dark:text-gray-300 mt-0.5">{isRequested ? 'Demandé' : 'Sur place'}</div>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
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
