import React from 'react';
import { Check, ChevronDown, Plus, Trash2, X } from 'lucide-react';
import { DOCTRINE_CONTEXT } from '../constants/doctrine';
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

const CATEGORIES: Record<string, { label: string; key: keyof typeof DOCTRINE_CONTEXT; color: string; statusClass: string; dashedClass: string }> = {
  incendie: { label: 'Incendie', key: 'incendie_structure', color: 'border-red-500/60 bg-red-500/10 text-red-200', statusClass: 'outline-red-400', dashedClass: 'border-red-400/80' },
  suap: { label: 'SUAP', key: 'secours_personne_complexe', color: 'border-green-500/60 bg-green-500/10 text-green-200', statusClass: 'outline-green-400', dashedClass: 'border-green-400/80' },
  speciaux: { label: 'Engins spéciaux', key: 'fuite_gaz', color: 'border-orange-400/60 bg-orange-500/10 text-orange-200', statusClass: 'outline-orange-400', dashedClass: 'border-orange-400/80' },
  commandement: { label: 'Commandement', key: 'secours_personne_complexe', color: 'border-purple-500/60 bg-purple-500/10 text-purple-200', statusClass: 'outline-purple-400', dashedClass: 'border-purple-400/80' },
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
    const data: { name: string; category: string }[] = [];
    Object.entries(CATEGORIES).forEach(([catKey, meta]) => {
      const ctx = (DOCTRINE_CONTEXT as any)[meta.key];
      const moyens = ctx?.moyens_standards_td || [];
      moyens.forEach((m: string) => {
        const title = m.split(':')[0].trim();
        data.push({ name: title, category: catKey });
      });
    });
    return data;
  }, []);

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
    <div className="flex flex-1 flex-col md:flex-row gap-4 overflow-hidden">
      <div className="w-full md:w-[28%] lg:w-[26%] border border-white/10 rounded-2xl p-4 space-y-3 overflow-y-auto bg-white/5">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-gray-200">Secteurs</h4>
          <button
            onClick={handleAddSector}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs text-white transition"
          >
            <Plus className="w-4 h-4" />
            Secteur
          </button>
        </div>
        <p className="text-[11px] text-gray-400">
          Les secteurs créés ici sont synchronisés automatiquement avec l&apos;onglet OCT.
        </p>
        {!sectors.length && (
          <div className="text-sm text-gray-400 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
            Aucun secteur pour le moment.
          </div>
        )}
        <div className="space-y-3">
          {sectors.map((sector) => {
            const subsectors = sector.children.filter((c) => c.type === 'subsector');
            return (
              <div key={sector.id} className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      value={sectorDrafts[sector.id] ?? sector.label}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSectorDrafts((prev) => ({ ...prev, [sector.id]: value }));
                        setSectorValidated((prev) => ({ ...prev, [sector.id]: false }));
                      }}
                      className={`w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 pr-10 ${
                        DEFAULT_SECTOR_LABELS.includes((sectorDrafts[sector.id] ?? sector.label ?? '').toUpperCase())
                          ? 'text-white/60'
                          : 'text-white'
                      }`}
                      placeholder="Nom du secteur"
                    />
                    {sectorValidated[sector.id] && (
                      <Check className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                    )}
                  </div>
                  <button
                    onClick={() => {
                      const label = (sectorDrafts[sector.id] ?? sector.label).trim();
                      handleRenameNode(sector.id, label);
                      setSectorDrafts((prev) => ({ ...prev, [sector.id]: label }));
                      setSectorValidated((prev) => ({ ...prev, [sector.id]: true }));
                    }}
                    className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs text-white border border-emerald-400/40 transition"
                  >
                    {sectorValidated[sector.id] ? 'Mettre à jour' : 'Valider'}
                  </button>
                  <button
                    onClick={() => handleDeleteNode(sector.id)}
                    className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 border border-white/10 text-red-300 transition"
                    title="Supprimer le secteur"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-2">
                  <button
                    onClick={() => setSubsectorOpen((prev) => ({ ...prev, [sector.id]: !prev[sector.id] }))}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-gray-200 transition"
                  >
                    <span className="uppercase tracking-wide text-[11px] text-gray-300">Sous-secteurs</span>
                    <ChevronDown
                      className={`w-4 h-4 text-gray-300 transition-transform ${subsectorOpen[sector.id] ? 'rotate-180' : 'rotate-0'}`}
                    />
                  </button>
                  {subsectorOpen[sector.id] && (
                    <>
                      {!subsectors.length && (
                        <div className="text-xs text-gray-500 bg-white/5 border border-white/10 rounded-lg px-2.5 py-2">
                          Aucun sous-secteur.
                        </div>
                      )}
                      {subsectors.map((sub) => (
                        <div key={sub.id} className="flex items-center gap-2">
                          <input
                            value={sub.label}
                            onChange={(e) => handleRenameNode(sub.id, e.target.value)}
                            className="flex-1 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                            placeholder="Nom du sous-secteur"
                          />
                          <button
                            onClick={() => handleDeleteNode(sub.id)}
                            className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 border border-white/10 text-red-300 transition"
                            title="Supprimer le sous-secteur"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => handleAddSubsector(sector.id)}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-dashed border-white/20 text-xs text-gray-200 transition"
                      >
                        <Plus className="w-4 h-4" />
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

      <div className="w-full md:w-[36%] lg:w-[37%] border border-white/10 rounded-2xl p-4 space-y-3 overflow-y-auto bg-white/5">
        <h4 className="text-sm font-semibold text-gray-200">Sélection</h4>
        {selected.length === 0 && <div className="text-gray-500 text-sm">Aucun moyen sélectionné.</div>}
        <div className="space-y-2">
          {selected.map((s) => {
            const colorMeta = CATEGORIES[s.category || ''] || { statusClass: 'outline-white/30', color: 'border-white/20 bg-white/5 text-white', dashedClass: 'border-yellow-400/80' };
            const isRequested = s.status === 'demande';
            const alreadyInOct = octTree ? meanExistsInTree(octTree, s.id) : false;
            const isAssigned = alreadyInOct;
            return (
              <div
                key={s.id}
                className={`space-y-2 px-3 py-3 rounded-lg border ${isRequested ? `border-dashed ${colorMeta.dashedClass || 'border-yellow-400/80'}` : colorMeta.color || 'border-white/20'} ${colorMeta.color?.replace('border', 'bg') || 'bg-white/5'} shadow-sm`}
              >
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="flex-1 text-sm text-gray-100 font-semibold">{s.name}</div>
                  <select
                    value={assignSelection[s.id] || assignableNodes[0]?.id || ''}
                    onChange={(e) => setAssignSelection((prev) => ({ ...prev, [s.id]: e.target.value }))}
                    className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[12px] text-gray-200 focus:outline-none focus:ring-2 focus:ring-white/20"
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
                      className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 border border-white/10 text-red-300 transition"
                      title="Retirer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleStatus(s.id)}
                      className={`relative w-16 h-8 rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-white/20 shadow-inner ${isRequested ? 'bg-amber-400/80 border-amber-200/80' : 'bg-emerald-400/80 border-emerald-200/80'}`}
                      aria-label={isRequested ? 'Basculer en sur place' : 'Basculer en demandé'}
                    >
                    <div className={`absolute inset-y-1 left-1 w-6 h-6 rounded-full bg-white shadow-lg transition-transform ${isRequested ? 'translate-x-7' : 'translate-x-0'}`} />
                    {!isRequested && <Check className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-900/90" />}
                  </button>
                  <span className="text-[12px] text-gray-200">{isRequested ? 'Demandé' : 'Sur place'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="w-full md:flex-1 border border-white/10 rounded-2xl p-4 space-y-4 overflow-y-auto bg-white/5">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-gray-200">Recueil des moyens</h4>
          <span className="text-[11px] text-gray-400">{meansList.length} disponibles</span>
        </div>
        {Object.entries(CATEGORIES).map(([catKey, meta]) => {
          const ctx = (DOCTRINE_CONTEXT as any)[meta.key];
          const moyens = ctx?.moyens_standards_td || [];
          if (!moyens.length) return null;
          return (
            <div key={catKey} className="space-y-2">
              <div className={`text-[11px] font-semibold mb-1 inline-block px-2 py-1 rounded ${meta.color}`}>
                {meta.label}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {moyens.map((m: string) => {
                  const title = m.split(':')[0].trim();
                  const already = selected.find((s) => s.name === title);
                  const isRequested = already?.status === 'demande';
                  return (
                    <button
                      key={title}
                      onClick={() => addMean({ name: title, category: catKey })}
                      className={`w-full text-left px-3 py-2 rounded-lg border ${already ? `border-dashed ${meta.dashedClass}` : 'border-white/15'} ${meta.color} hover:bg-white/10 transition`}
                    >
                      <div className="text-sm leading-tight">{title}</div>
                      {already && <div className="text-[11px] text-gray-300 mt-0.5">{isRequested ? 'Demandé' : 'Sur place'}</div>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  if (inline) {
    return (
      <div className="w-full bg-[#0f121a] border border-white/10 rounded-2xl shadow-lg flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">Moyens</h3>
        </div>
        {content}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#0f121a] border border-white/10 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">Ajouter des moyens</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        {content}
      </div>
    </div>
  );
};

export default MeansModal;
