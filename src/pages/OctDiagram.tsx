import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  Edge,
  MarkerType,
  MiniMap,
  Node,
  NodeProps,
  Position,
  ReactFlowInstance,
  getNodesBounds,
  getViewportForBounds,
  useEdgesState,
  useNodesState
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Download, RefreshCw, RotateCw } from 'lucide-react';
import { exportBoardDesignPdf } from '../utils/export';
import { useSessionSettings } from '../utils/sessionSettings';
import type { MeanItem } from '../types/means';
import { OctColor, OctNodeType, OctTreeNode, useOctTree, resetOctTree, createInitialOctTree } from '../utils/octTreeStore';
import { useTheme } from '../contexts/ThemeContext';
import { useInterventionStore } from '../stores/useInterventionStore';
import { useMeansStore } from '../stores/useMeansStore';
import { debounce } from '../utils/debounce';
import { telemetryBuffer } from '../utils/telemetryBuffer';

type MeanSource = 'manual' | 'means';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isMeanSource = (value: unknown): value is MeanSource =>
  value === 'manual' || value === 'means';

const toMeanSource = (value?: string): MeanSource | undefined =>
  isMeanSource(value) ? value : undefined;

interface OctNodeData {
  nodeId: string;
  label: string;
  type: OctNodeType;
  frequencies: string[];
  notes?: string;
  color?: OctColor;
  chief?: string;
  meanSource?: MeanSource;
  meanStatus?: 'sur_place' | 'demande';
  meanCategory?: string;
  onEdit: (id: string) => void;
  onAdd: (id: string, type?: OctNodeType) => void;
  onDelete: (id: string) => void;
  onToggleStatus?: (id: string) => void;
  canDelete: boolean;
  selected?: boolean;
}

interface LayoutCallbacks {
  onEdit: (id: string) => void;
  onAdd: (id: string, type?: OctNodeType) => void;
  onDelete: (id: string) => void;
  onToggleStatus?: (id: string) => void;
  selectedId?: string | null;
  rootId: string;
}

const NODE_WIDTH = 240;
const NODE_HEIGHT = 120;
const ENGINE_HEIGHT = 78;
const LEVEL_GAP = 190;
const SIBLING_GAP = 60;

const TYPE_META: Record<
  OctNodeType,
  { title: string; gradient: string; border: string; badge: string; chip: string }
> = {
  codis: {
    title: 'CODIS',
    gradient: 'from-purple-900/80 via-indigo-900/80 to-slate-900/85',
    border: 'border-purple-300/50',
    badge: 'bg-purple-300/20 text-purple-100',
    chip: 'bg-purple-950/70 text-purple-100'
  },
  cos: {
    title: 'COS',
    gradient: 'from-fuchsia-600/70 via-violet-700/70 to-purple-900/80',
    border: 'border-fuchsia-300/60',
    badge: 'bg-fuchsia-400/20 text-fuchsia-100',
    chip: 'bg-fuchsia-950/60 text-fuchsia-100'
  },
  sector: {
    title: 'Secteur',
    gradient: 'from-amber-500/70 via-orange-600/70 to-amber-900/70',
    border: 'border-amber-300/70',
    badge: 'bg-amber-300/20 text-amber-50',
    chip: 'bg-amber-950/60 text-amber-100'
  },
  subsector: {
    title: 'Sous-secteur',
    gradient: 'from-emerald-600/70 via-green-700/70 to-emerald-900/70',
    border: 'border-emerald-300/70',
    badge: 'bg-emerald-300/20 text-emerald-50',
    chip: 'bg-emerald-950/60 text-emerald-100'
  },
  engine: {
    title: 'Engin',
    gradient: 'from-slate-600/70 via-slate-700/70 to-slate-900/80',
    border: 'border-slate-300/60',
    badge: 'bg-slate-300/20 text-slate-50',
    chip: 'bg-slate-950/60 text-slate-100'
  }
};

const COLOR_META: Record<OctColor, { gradient: string; border: string; badge: string; chip: string }> = {
  red: {
    gradient: 'from-red-600/80 via-red-700/80 to-red-900/85',
    border: 'border-red-300/60',
    badge: 'bg-red-300/25 text-red-100',
    chip: 'bg-red-950/70 text-red-100'
  },
  green: {
    gradient: 'from-emerald-600/80 via-green-700/80 to-emerald-900/85',
    border: 'border-emerald-300/60',
    badge: 'bg-emerald-300/25 text-emerald-100',
    chip: 'bg-emerald-950/70 text-emerald-100'
  },
  orange: {
    gradient: 'from-amber-500/80 via-orange-600/80 to-amber-900/85',
    border: 'border-amber-300/70',
    badge: 'bg-amber-300/25 text-amber-50',
    chip: 'bg-amber-950/70 text-amber-100'
  },
  blue: {
    gradient: 'from-sky-600/80 via-blue-700/80 to-blue-900/85',
    border: 'border-sky-300/60',
    badge: 'bg-sky-300/25 text-sky-100',
    chip: 'bg-sky-950/70 text-sky-100'
  },
  violet: {
    gradient: 'from-violet-400/80 via-fuchsia-500/80 to-purple-800/80',
    border: 'border-violet-200/70',
    badge: 'bg-violet-200/25 text-violet-900',
    chip: 'bg-violet-900/60 text-violet-100'
  }
};

const getNodeMeta = (type: OctNodeType, color?: OctColor) => {
  if ((type === 'sector' || type === 'subsector' || type === 'engine') && color) {
    return { title: TYPE_META[type].title, ...COLOR_META[color] };
  }
  return TYPE_META[type];
};

const canPickColor = (type: OctNodeType) => type === 'sector' || type === 'subsector' || type === 'engine';

const computeWidths = (node: OctTreeNode, map: Map<string, number>): number => {
  node.children.forEach((child) => computeWidths(child, map));

  const isSectorLike = node.type === 'sector' || node.type === 'subsector';
  const horizontalChildren = isSectorLike ? node.children.filter((c) => c.type !== 'engine') : node.children;

  if (!horizontalChildren.length) {
    map.set(node.id, NODE_WIDTH);
    return NODE_WIDTH;
  }

  const spacing = horizontalChildren.length > 1 ? (horizontalChildren.length - 1) * SIBLING_GAP : 0;
  const total = horizontalChildren.reduce((acc, child) => acc + (map.get(child.id) || NODE_WIDTH), 0) + spacing;
  const width = Math.max(NODE_WIDTH, total);
  map.set(node.id, width);
  return width;
};

const assignPositions = (
  node: OctTreeNode,
  depth: number,
  startX: number,
  widths: Map<string, number>,
  callbacks: LayoutCallbacks
): { nodes: Node<OctNodeData>[]; edges: Edge[] } => {
  const width = widths.get(node.id) || NODE_WIDTH;
  const x = startX + width / 2 - NODE_WIDTH / 2;
  const y = depth * LEVEL_GAP;
  const meta = TYPE_META[node.type];
  const nodeHeight = node.type === 'engine' ? ENGINE_HEIGHT : NODE_HEIGHT;

  const current: Node<OctNodeData> = {
    id: node.id,
    type: 'octNode',
    position: { x, y },
    targetPosition: Position.Top,
    sourcePosition: Position.Bottom,
  data: {
    nodeId: node.id,
    label: node.label,
    type: node.type,
    frequencies: node.frequencies || [],
    notes: node.notes,
    color: node.color,
    chief: node.chief,
    meanSource: toMeanSource(node.meanSource),
    meanStatus: node.meanStatus,
    meanCategory: node.meanCategory,
    onEdit: callbacks.onEdit,
    onAdd: callbacks.onAdd,
    onDelete: callbacks.onDelete,
    onToggleStatus: callbacks.onToggleStatus,
    canDelete: node.id !== callbacks.rootId,
      selected: callbacks.selectedId === node.id
    },
    style: {
      width: NODE_WIDTH,
      height: nodeHeight,
      borderRadius: 18,
      border: `1px solid ${meta ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'}`,
      boxShadow: '0 10px 40px rgba(0,0,0,0.35)'
    },
    draggable: false,
    selectable: true
  };

  let nodes = [current];
  let edges: Edge[] = [];
  let cursor = startX;

  const isSectorLike = node.type === 'sector' || node.type === 'subsector';
  const horizontalChildren = isSectorLike ? node.children.filter((c) => c.type !== 'engine') : node.children;
  const engineChildren = isSectorLike ? node.children.filter((c) => c.type === 'engine') : [];

  horizontalChildren.forEach((child) => {
    const childWidth = widths.get(child.id) || NODE_WIDTH;
    const childResult = assignPositions(child, depth + 1, cursor, widths, callbacks);
    nodes = nodes.concat(childResult.nodes);
    edges = edges.concat(childResult.edges);
    edges.push({
      id: `e-${node.id}-${child.id}`,
      source: node.id,
      target: child.id,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: '#6EE7B7' },
      style: { stroke: '#6EE7B7', strokeWidth: 2 }
    });
    cursor += childWidth + SIBLING_GAP;
  });

  if (engineChildren.length) {
    engineChildren.forEach((child, idx) => {
      const childX = startX + width / 2 - NODE_WIDTH / 2;
      const engineGap = ENGINE_HEIGHT + 10;
      const childY = y + LEVEL_GAP - 20 + idx * engineGap;
      const meta = getNodeMeta(child.type, child.color);
      nodes.push({
        id: child.id,
        type: 'octNode',
        position: { x: childX, y: childY },
        targetPosition: Position.Top,
        sourcePosition: Position.Bottom,
        data: {
          nodeId: child.id,
          label: child.label,
          type: child.type,
          frequencies: child.frequencies || [],
          notes: child.notes,
          color: child.color,
          chief: child.chief,
          meanSource: toMeanSource(child.meanSource),
          meanStatus: child.meanStatus,
          meanCategory: child.meanCategory,
          onEdit: callbacks.onEdit,
          onAdd: callbacks.onAdd,
          onDelete: callbacks.onDelete,
          onToggleStatus: callbacks.onToggleStatus,
          canDelete: child.id !== callbacks.rootId,
          selected: callbacks.selectedId === child.id
        },
        style: {
          width: NODE_WIDTH,
          height: ENGINE_HEIGHT,
          borderRadius: 18,
          border: `1px solid ${meta ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'}`,
          boxShadow: '0 10px 40px rgba(0,0,0,0.35)'
        },
        draggable: false,
        selectable: true
      });
      edges.push({
        id: `e-${node.id}-${child.id}`,
        source: node.id,
        target: child.id,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: '#6EE7B7' },
        style: { stroke: '#6EE7B7', strokeWidth: 2 }
      });
    });
  }

  return { nodes, edges };
};

const buildLayout = (
  root: OctTreeNode,
  callbacks: LayoutCallbacks
): { nodes: Node<OctNodeData>[]; edges: Edge[] } => {
  const widths = new Map<string, number>();
  computeWidths(root, widths);
  const { nodes, edges } = assignPositions(root, 0, 0, widths, callbacks);
  const minX = Math.min(...nodes.map((n) => n.position.x));
  if (minX < 0) {
    const offset = Math.abs(minX) + 40;
    nodes.forEach((n) => {
      n.position = { ...n.position, x: n.position.x + offset };
    });
  }
  return { nodes, edges };
};

const findNodeById = (node: OctTreeNode, id: string): OctTreeNode | null => {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
};

const updateNodeById = (
  node: OctTreeNode,
  id: string,
  updater: (n: OctTreeNode) => OctTreeNode
): OctTreeNode => {
  if (node.id === id) return updater(node);
  return {
    ...node,
    children: node.children.map((child) => updateNodeById(child, id, updater))
  };
};

const addChildToTree = (node: OctTreeNode, parentId: string, child: OctTreeNode): OctTreeNode => {
  if (node.id === parentId) {
    return { ...node, children: [...node.children, child] };
  }
  return {
    ...node,
    children: node.children.map((c) => addChildToTree(c, parentId, child))
  };
};

const findParentId = (node: OctTreeNode, id: string, parentId: string | null = null): string | null => {
  if (node.id === id) return parentId;
  for (const child of node.children) {
    const found = findParentId(child, id, node.id);
    if (found) return found;
  }
  return null;
};

const removeNodeById = (node: OctTreeNode, id: string): OctTreeNode => {
  return {
    ...node,
    children: node.children
      .filter((child) => child.id !== id)
      .map((child) => removeNodeById(child, id))
  };
};

const collectAllIds = (node: OctTreeNode, acc: Set<string>) => {
  acc.add(node.id);
  node.children.forEach((child) => collectAllIds(child, acc));
  return acc;
};

const collectSubtreeIds = (node: OctTreeNode, targetId: string, acc: Set<string> = new Set()): Set<string> => {
  if (node.id === targetId) {
    return collectAllIds(node, acc);
  }
  for (const child of node.children) {
    const res = collectSubtreeIds(child, targetId, acc);
    if (res.size > acc.size) return res;
  }
  return acc;
};

const applyColorToSubtree = (node: OctTreeNode, color: OctColor): OctTreeNode => {
  const canColor = node.type === 'sector' || node.type === 'subsector' || node.type === 'engine';
  return {
    ...node,
    color: canColor ? color : node.color,
    children: node.children.map((child) => applyColorToSubtree(child, color))
  };
};

const collectUsedMeans = (node: OctTreeNode, acc: Set<string>) => {
  if (node.meanSource === 'means' && node.meanRef) {
    acc.add(node.meanRef);
  }
  node.children.forEach((child) => collectUsedMeans(child, acc));
  return acc;
};

const collectMeanRefs = (node: OctTreeNode, acc: Set<string>) => {
  if (node.meanSource === 'means' && node.meanRef) {
    acc.add(node.meanRef);
  }
  node.children.forEach((child) => collectMeanRefs(child, acc));
  return acc;
};

const OctFlowNode: React.FC<NodeProps<OctNodeData>> = ({ data, selected }) => {
  const meta = getNodeMeta(data.type, data.color);
  const statusBadge =
    data.meanStatus === 'demande'
      ? 'bg-amber-500/20 text-amber-100 border border-amber-300/40'
      : data.meanStatus === 'sur_place'
        ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-300/40'
        : '';
  const borderStyle =
    data.meanStatus === 'demande'
      ? '2px dashed rgba(251,191,36,0.8)'
      : '1.5px solid rgba(255,255,255,0.2)';
  const demandOverlay =
    data.meanStatus === 'demande'
      ? { filter: 'brightness(1.25)', backgroundColor: 'rgba(255,255,255,0.08)' }
      : {};
  return (
    <div
      className={`w-full h-full rounded-2xl bg-gradient-to-br ${meta?.gradient || 'from-slate-700/70 to-slate-900/80'} text-white shadow-xl flex flex-col overflow-hidden pointer-events-auto ${selected ? 'ring-2 ring-white/60' : ''}`}
      style={{ border: borderStyle, boxSizing: 'border-box', ...demandOverlay }}
    >
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 bg-black/15 gap-2">
        <div className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full ${meta?.badge || 'bg-white/10'}`}>
          {meta?.title || 'Cellule'}
        </div>
        <div className="flex items-center gap-2">
          {statusBadge && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                data.onToggleStatus?.(data.nodeId);
              }}
              className={`text-[10px] px-2 py-[2px] rounded-full ${statusBadge} hover:opacity-80 transition`}
              title="Basculer le statut"
            >
              {data.meanStatus === 'demande' ? 'Demandé' : 'Sur place'}
            </button>
          )}
          {data.type === 'sector' && (
            <div className="text-[12px] font-semibold text-white truncate text-right">{data.label}</div>
          )}
        </div>
      </div>
      <div className="flex-1 px-3 py-1.5 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="text-sm font-semibold leading-tight drop-shadow-sm text-white/90">
            {data.chief || data.label}
          </div>
          {data.frequencies.length > 0 && (
            <div className="flex flex-col items-end gap-1 text-right">
              {data.frequencies.map((f) => (
                <span key={f} className={`text-[10px] px-2 py-[2px] rounded-full leading-tight ${meta?.chip || 'bg-white/5'}`}>
                  Fréq. {f}
                </span>
              ))}
            </div>
          )}
        </div>
        {data.notes && <p className="text-[11px] text-white/80 leading-tight max-h-[40px] overflow-hidden">{data.notes}</p>}
      </div>
      <div className="px-3 pb-2 flex">
        {data.type !== 'codis' && data.type !== 'engine' && data.nodeId !== 'node-air' && data.nodeId !== 'node-crm' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              data.onAdd(data.nodeId, data.type === 'cos' ? 'sector' : undefined);
            }}
            className={`w-full text-xs px-3 py-1.5 rounded-xl bg-black/30 hover:bg-black/40 border transition ${
              data.type === 'cos' ? 'border-white/70' : 'border-white/20'
            }`}
          >
            {data.type === 'cos' ? '+ Secteur' : '+ Engin / Sous-secteur'}
          </button>
        )}
      </div>
    </div>
  );
};

const nodeTypes = { octNode: OctFlowNode };

interface EditorState {
  id: string;
  label: string;
  type: OctNodeType;
  freqUp: string;
  freqDown: string;
  notes: string;
  color?: OctColor;
  chief: string;
}

interface OctDiagramProps {
  embedded?: boolean;
  availableMeans?: MeanItem[];
  exportMeta?: { adresse?: string; heure?: string };
}

export const OctDiagram: React.FC<OctDiagramProps> = ({ embedded = false, availableMeans = [], exportMeta }) => {
  const { resolvedTheme } = useTheme();
  const currentInterventionId = useInterventionStore((s) => s.currentInterventionId);
  const interventionStartedAtMs = useInterventionStore((s) => s.interventionStartedAtMs);

  const { settings } = useSessionSettings();
  const octDefaults = settings.octDefaults;

  const getDefaultFrequencyPair = useCallback(
    (type: OctNodeType) => {
      const defaults = octDefaults?.[type];
      return {
        up: defaults?.up?.trim() || '',
        down: defaults?.down?.trim() || ''
      };
    },
    [octDefaults]
  );

  const getDefaultFrequencies = useCallback(
    (type: OctNodeType) => {
      const pair = getDefaultFrequencyPair(type);
      return [pair.up, pair.down].filter(Boolean);
    },
    [getDefaultFrequencyPair]
  );
  const { tree, setTree } = useOctTree();
  const selectedMeans = useMeansStore((s) => s.selectedMeans);
  const setSelectedMeans = useMeansStore((s) => s.setSelectedMeans);
  const queueOctTelemetry = useMemo(
    () =>
      debounce((patch: unknown) => {
        if (!isRecord(patch)) return;
        telemetryBuffer.addSample({
          interventionId: currentInterventionId,
          stream: 'OCT',
          patch,
          interventionStartedAtMs,
          uiContext: 'oct/editor'
        });
      }, 2500),
    [currentInterventionId, interventionStartedAtMs]
  );
  const [selectedId, setSelectedId] = useState<string>(tree.id);
  const [nodes, setNodes, onNodesChange] = useNodesState<OctNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [isPortrait, setIsPortrait] = useState(false);
  const [flowReady, setFlowReady] = useState(false);
  const flowRef = useRef<ReactFlowInstance | null>(null);
  const layoutSignatureRef = useRef<string | null>(null);
  const forceFitViewRef = useRef(true);
  const diagramRef = useRef<HTMLDivElement | null>(null);
  const diagramHeight = embedded ? '75vh' : '85vh';
  const canDeleteEditor = editor && editor.id !== tree.id;
  const COLOR_OPTIONS: { value: OctColor; label: string }[] = [
    { value: 'red', label: 'Rouge' },
    { value: 'green', label: 'Vert' },
    { value: 'orange', label: 'Orange' },
    { value: 'blue', label: 'Bleu' },
    { value: 'violet', label: 'Violet' }
  ];
  const [addDialog, setAddDialog] = useState<{ parentId: string } | null>(null);
  const [manualAdd, setManualAdd] = useState<{ label: string; status: 'sur_place' | 'demande'; freqUp: string; freqDown: string; color: OctColor }>({
    label: 'Nouvel engin',
    status: 'sur_place',
    freqUp: '',
    freqDown: '',
    color: 'orange'
  });
  const usedMeanRefs = useMemo(() => collectUsedMeans(tree, new Set<string>()), [tree]);
  const addParentNode = addDialog ? findNodeById(tree, addDialog.parentId) : null;
  const selectableMeans = useMemo(
    () => availableMeans.filter((m) => !usedMeanRefs.has(m.id)),
    [availableMeans, usedMeanRefs]
  );
  const isDark = resolvedTheme === 'dark';
  const gridDotColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(15,23,42,0.12)';
  useEffect(() => {
    return () => {
      queueOctTelemetry.flush();
      queueOctTelemetry.cancel();
    };
  }, [queueOctTelemetry]);

  useEffect(() => {
    if (!findNodeById(tree, selectedId)) {
      setSelectedId(tree.id);
    }
    setEditor((prevEditor) => {
      if (prevEditor && findNodeById(tree, prevEditor.id)) return prevEditor;
      return null;
    });
  }, [tree, selectedId]);

  const setEditorFromId = useCallback(
    (id: string) => {
      const target = findNodeById(tree, id);
      if (!target) return;
      setEditor({
        id: target.id,
        label: target.label,
        type: target.type,
        freqUp: (target.frequencies || [])[0] || '',
        freqDown: (target.frequencies || [])[1] || '',
        notes: target.notes || '',
        color: target.color,
        chief: target.chief || ''
      });
      setSelectedId(id);
    },
    [tree]
  );

  const handleAddChild = useCallback(
    (
      parentId?: string,
      forcedType?: OctNodeType,
      extra?: Partial<OctTreeNode>,
      opts?: { openEditor?: boolean }
    ) => {
      const newId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `node-${Date.now()}`;

      const buildDefaultNode = (type: OctNodeType): OctTreeNode => {
        const labelMap: Partial<Record<OctNodeType, string>> = {
          sector: 'Nouveau secteur',
          subsector: 'Nouveau sous-secteur',
          engine: 'Nouvel engin'
        };
        const defaultColor: Partial<Record<OctNodeType, OctColor>> = {
          sector: 'red',
          subsector: 'orange',
          engine: 'orange'
        };
        return {
          id: newId,
          type,
          label: labelMap[type] || 'Nouvelle branche',
          frequencies: getDefaultFrequencies(type),
          notes: '',
          color: defaultColor[type],
          chief: '',
          children: []
        };
      };

      const targetId = parentId || selectedId || tree.id;
      const targetNode = findNodeById(tree, targetId);
      const inferredType = forcedType || (targetNode?.type === 'cos' ? 'sector' : 'subsector');
      const actualTarget = targetNode ? targetId : tree.id;
      const newNode: OctTreeNode = { ...buildDefaultNode(inferredType), ...extra, id: newId, type: inferredType };

      queueOctTelemetry({
        action: 'add',
        nodeId: newId,
        parentId: actualTarget,
        selectedNodeId: newId,
        type: newNode.type,
        label: newNode.label,
        meanSource: newNode.meanSource,
        meanStatus: newNode.meanStatus,
        meanCategory: newNode.meanCategory,
        color: newNode.color
      });

      setTree((prev) => {
        const runtimeTargetId = parentId || selectedId || prev.id;
        const runtimeTargetNode = findNodeById(prev, runtimeTargetId);
        const runtimeInferredType =
          forcedType || (runtimeTargetNode?.type === 'cos' ? 'sector' : 'subsector');
        const runtimeNode: OctTreeNode = {
          ...buildDefaultNode(runtimeInferredType),
          ...extra,
          id: newId,
          type: runtimeInferredType
        };

        const exists = !!runtimeTargetNode;
        const runtimeTarget = exists ? runtimeTargetId : prev.id;
        const nextTree = addChildToTree(prev, runtimeTarget, runtimeNode);

        setSelectedId(newId);
        if (opts?.openEditor !== false) {
          setEditor({
            id: newId,
            label: runtimeNode.label,
            type: runtimeNode.type,
            freqUp: runtimeNode.frequencies?.[0] || '',
            freqDown: runtimeNode.frequencies?.[1] || '',
            notes: runtimeNode.notes || '',
            color: runtimeNode.color,
            chief: runtimeNode.chief || ''
          });
        }

        return nextTree;
      });
    },
    [selectedId, setTree, getDefaultFrequencies, queueOctTelemetry, tree]
  );

  const openAddDialog = useCallback(
    (parentId: string) => {
      const parent = findNodeById(tree, parentId);
      const inheritedColor = (parent?.color as OctColor) || 'orange';
      const defaultFreqs = getDefaultFrequencyPair('engine');
      setManualAdd({
        label: 'Nouvel engin',
        status: 'sur_place',
        freqUp: defaultFreqs.up,
        freqDown: defaultFreqs.down,
        color: inheritedColor
      });
      setAddDialog({ parentId });
    },
    [tree, getDefaultFrequencyPair]
  );

  const handleAddEntry = useCallback(
    (parentId: string, forcedType?: OctNodeType) => {
      const target = findNodeById(tree, parentId);
      if (!target) return;
      if (target.type === 'sector' || target.type === 'subsector') {
        openAddDialog(parentId);
        return;
      }
      handleAddChild(parentId, forcedType);
    },
    [tree, openAddDialog, handleAddChild]
  );

  const handleAddEngineFromMean = useCallback(
    (parentId: string, mean: MeanItem) => {
      const parent = findNodeById(tree, parentId);
      const inheritedColor = (parent?.color as OctColor) || 'orange';
      handleAddChild(parentId, 'engine', {
        label: mean.name,
        meanSource: 'means',
        meanRef: mean.id,
        meanStatus: mean.status,
        meanCategory: mean.category,
        color: inheritedColor
      }, { openEditor: false });
      setAddDialog(null);
    },
    [handleAddChild, tree]
  );

  const handleAddManualEngine = useCallback(() => {
    if (!addDialog) return;
    handleAddChild(
      addDialog.parentId,
      'engine',
      {
        label: manualAdd.label || 'Nouvel engin',
        meanSource: 'manual',
        meanStatus: manualAdd.status,
        frequencies: [manualAdd.freqUp, manualAdd.freqDown].filter(Boolean),
        color: manualAdd.color
      },
      { openEditor: false }
    );
    setAddDialog(null);
  }, [addDialog, handleAddChild, manualAdd]);

  const handleAddSubsector = useCallback(() => {
    if (!addDialog) return;
    handleAddChild(addDialog.parentId, 'subsector', undefined, { openEditor: false });
    setAddDialog(null);
  }, [addDialog, handleAddChild]);

  const handleDelete = useCallback(
    (id: string) => {
      if (id === tree.id) return;
      const parentId = findParentId(tree, id) || tree.id;
      const removedCount = collectSubtreeIds(tree, id).size;
      const targetNode = findNodeById(tree, id);
      const meanRefs = targetNode ? collectMeanRefs(targetNode, new Set()) : new Set<string>();
      if (meanRefs.size > 0 && selectedMeans.length > 0) {
        const nextMeans = selectedMeans.filter((mean) => !meanRefs.has(mean.id));
        if (nextMeans.length !== selectedMeans.length) {
          setSelectedMeans(nextMeans);
        }
      }
      queueOctTelemetry({
        action: 'delete',
        nodeId: id,
        parentId,
        removedCount
      });
      setTree((prev) => {
        if (id === prev.id) return prev;
        const parentId = findParentId(prev, id) || prev.id;
        const nextTree = removeNodeById(prev, id);
        setSelectedId((current) => (current === id ? parentId : current));
        if (editor && editor.id === id) setEditor(null);
        return nextTree;
      });
    },
    [editor, setTree, setSelectedId, queueOctTelemetry, tree, selectedMeans, setSelectedMeans]
  );

  const handleSave = useCallback(() => {
    if (!editor) return;
    const freqs = [editor.freqUp, editor.freqDown].map((f) => f.trim()).filter(Boolean);
    const currentNode = findNodeById(tree, editor.id);
    if (currentNode) {
      const fieldsChanged: Record<string, unknown> = {};
      const nextLabel = editor.label || currentNode.label;
      if (currentNode.label !== nextLabel) fieldsChanged.label = nextLabel;
      if (currentNode.type !== editor.type) fieldsChanged.type = editor.type;
      const previousFreqUp = (currentNode.frequencies || [])[0] || '';
      const previousFreqDown = (currentNode.frequencies || [])[1] || '';
      const nextFreqUp = freqs[0] || '';
      const nextFreqDown = freqs[1] || '';
      if (previousFreqUp !== nextFreqUp) fieldsChanged.freqUp = nextFreqUp;
      if (previousFreqDown !== nextFreqDown) fieldsChanged.freqDown = nextFreqDown;
      const previousNotes = currentNode.notes || '';
      if (previousNotes !== editor.notes) fieldsChanged.notes = editor.notes;
      if (canPickColor(editor.type)) {
        if ((currentNode.color || null) !== (editor.color || null)) {
          fieldsChanged.color = editor.color;
        }
        if ((currentNode.chief || '') !== (editor.chief || '')) {
          fieldsChanged.chief = editor.chief;
        }
      }
      if (Object.keys(fieldsChanged).length > 0) {
        queueOctTelemetry({
          action: 'update',
          nodeId: editor.id,
          selectedNodeId: editor.id,
          fieldsChanged
        });
      }
    }
    setTree((prev) =>
      updateNodeById(prev, editor.id, (n) => {
        const nextColor = canPickColor(editor.type) ? editor.color : undefined;
        const nextNode: OctTreeNode = {
          ...n,
          label: editor.label || n.label,
          type: editor.type,
          frequencies: freqs,
          notes: editor.notes,
          color: nextColor,
          chief: canPickColor(editor.type) ? editor.chief : n.chief
        };
        const cascadeColor = nextNode.color;
        const shouldCascade =
          (nextNode.type === 'sector' || nextNode.type === 'subsector') &&
          cascadeColor &&
          (n.color || null) !== (cascadeColor || null);
        return shouldCascade ? applyColorToSubtree(nextNode, cascadeColor) : nextNode;
      })
    );
    setEditor(null);
  }, [editor, setTree, queueOctTelemetry, tree]);

  const handleReset = () => {
    const previousCount = collectAllIds(tree, new Set()).size;
    queueOctTelemetry({
      action: 'reset',
      previousCount,
      selectedNodeId: tree.id
    });
    layoutSignatureRef.current = null;
    forceFitViewRef.current = true;
    const base = createInitialOctTree();
    resetOctTree();
    setSelectedId(base.id);
    setEditor(null);
  };

  const handleExportPdf = useCallback(async () => {
    if (!diagramRef.current) return;
    try {
      await exportBoardDesignPdf(diagramRef.current, exportMeta);
    } catch (err) {
      console.error('Export PDF failed', err);
    }
  }, [exportMeta]);

  const handleToggleStatus = useCallback(
    (id: string) => {
      const currentNode = findNodeById(tree, id);
      if (currentNode?.type === 'engine' && currentNode.meanStatus) {
        const nextStatus = currentNode.meanStatus === 'demande' ? 'sur_place' : 'demande';
        queueOctTelemetry({
          action: 'toggle_status',
          nodeId: id,
          status: nextStatus
        });
      }
      setTree((prev) =>
        updateNodeById(prev, id, (n) => {
          if (n.type !== 'engine' || !n.meanStatus) return n;
          return { ...n, meanStatus: n.meanStatus === 'demande' ? 'sur_place' : 'demande' };
        })
      );
    },
    [setTree, queueOctTelemetry, tree]
  );

  const layout = useMemo(
    () =>
      buildLayout(tree, {
        onEdit: setEditorFromId,
        onAdd: handleAddEntry,
        onDelete: handleDelete,
        onToggleStatus: handleToggleStatus,
        selectedId,
        rootId: tree.id
      }),
    [tree, selectedId, setEditorFromId, handleAddEntry, handleDelete, handleToggleStatus]
  );

  const adjustedLayout = useMemo(() => {
    const nodesCopy = layout.nodes.map((n) => ({ ...n, position: { ...n.position } }));
    const edgesCopy = layout.edges;
    const codis = nodesCopy.find((n) => n.id === 'root');
    const cos = nodesCopy.find((n) => n.id === 'node-2');
    const air = nodesCopy.find((n) => n.id === 'node-air');
    const crm = nodesCopy.find((n) => n.id === 'node-crm');

    if (codis && cos) {
      const delta = codis.position.x - cos.position.x;
      if (delta !== 0) {
        const subtreeIds = collectSubtreeIds(tree, 'node-2');
        nodesCopy.forEach((n) => {
          if (subtreeIds.has(n.id)) {
            n.position = { ...n.position, x: n.position.x + delta };
          }
        });
      }
    }

    const cosNode = nodesCopy.find((n) => n.id === 'node-2');
    if (cosNode && (air || crm)) {
      const baseY = cosNode.position.y;
      const leftX = cosNode.position.x - NODE_WIDTH - 120;
      const rightX = cosNode.position.x + NODE_WIDTH + 120;
      if (air) {
        air.position = { x: leftX, y: baseY };
      }
      if (crm) {
        crm.position = { x: rightX, y: baseY };
      }
    }

    return { nodes: nodesCopy, edges: edgesCopy };
  }, [layout.nodes, layout.edges, tree]);

  useEffect(() => {
    setNodes(adjustedLayout.nodes);
    setEdges(adjustedLayout.edges);
  }, [adjustedLayout.nodes, adjustedLayout.edges, setNodes, setEdges]);

  const centerLayoutInView = useCallback(() => {
    const instance = flowRef.current;
    if (!instance || !diagramRef.current) return;
    const bounds = getNodesBounds(layout.nodes);
    const rect = diagramRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const viewport = getViewportForBounds(bounds, rect.width, rect.height, 0.2, 1.2, 0.3);
    instance.setCenter(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, {
      zoom: viewport.zoom,
      duration: 500
    });
  }, [layout.nodes]);

  useEffect(() => {
    if (!flowReady || !flowRef.current) return;
    if (!layout.nodes.length) return;
    const signature = layout.nodes
      .map((node) => node.id)
      .sort()
      .join('|');
    const shouldFit = forceFitViewRef.current || signature !== layoutSignatureRef.current;
    if (!shouldFit) return;
    layoutSignatureRef.current = signature;
    forceFitViewRef.current = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(centerLayoutInView);
    });
  }, [layout.nodes, flowReady, centerLayoutInView]);

  useEffect(() => {
    if (!flowReady || !diagramRef.current) return;
    const element = diagramRef.current;
    let frame: number | null = null;
    const observer = new ResizeObserver(() => {
      if (!layout.nodes.length) return;
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
      frame = window.requestAnimationFrame(() => {
        centerLayoutInView();
      });
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [centerLayoutInView, flowReady, layout.nodes.length]);

  useEffect(() => {
    const updateOrientation = () => setIsPortrait(window.innerHeight > window.innerWidth);
    updateOrientation();
    window.addEventListener('resize', updateOrientation);
    return () => window.removeEventListener('resize', updateOrientation);
  }, []);

  return (
    <div
      className={`text-slate-900 dark:text-white relative overflow-hidden ${embedded ? 'w-full' : 'min-h-screen bg-slate-50 dark:bg-[#0A0A0A]'}`}
    >
      {!embedded && (
        <>
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[160px]" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-rose-900/20 rounded-full blur-[160px]" />
        </>
      )}

      <div className={`${embedded ? 'relative z-10 w-full space-y-6' : 'relative z-10 max-w-7xl mx-auto px-4 py-8 space-y-6'}`}>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-slate-900 dark:text-cyan-200 uppercase tracking-[0.25em]">
              OCT – Ordre Complémentaire des Transmissions
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleReset}
              className="px-4 py-3 rounded-2xl bg-black/40 hover:bg-black/60 border border-white/15 text-white flex items-center gap-2 transition"
            >
              <RefreshCw className="w-4 h-4" /> Réinitialiser
            </button>
            <button
              onClick={handleExportPdf}
              className="px-4 py-3 rounded-2xl bg-blue-600/80 hover:bg-blue-600 border border-blue-400/60 text-white flex items-center gap-2 transition"
            >
              <Download className="w-4 h-4" /> Exporter en PDF
            </button>
          </div>
        </div>

        <div
          ref={diagramRef}
          className={`relative bg-slate-100 dark:bg-[#0c1424] border border-slate-200/80 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden ${isPortrait ? 'opacity-40 pointer-events-none' : ''}`}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-slate-200/60 via-transparent to-cyan-200/40 pointer-events-none dark:from-white/5 dark:to-cyan-500/5" />
          <div className="relative z-10" style={{ height: diagramHeight }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={(_, node) => {
                setSelectedId(node.id);
                setEditorFromId(node.id);
              }}
              proOptions={{ hideAttribution: true }}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable
              zoomOnScroll
              zoomOnPinch
              defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
              onInit={(instance) => {
                flowRef.current = instance;
                setFlowReady(true);
              }}
            >
              <MiniMap
                nodeColor={(n) => {
                  const colorPalette: Record<OctColor, string> = {
                    red: '#f87171',
                    green: '#34d399',
                    orange: '#f59e0b',
                    blue: '#38bdf8',
                    violet: '#c084fc'
                  };
                  const defaultPalette: Record<OctNodeType, string> = {
                    codis: '#a855f7',
                    cos: '#e879f9',
                    sector: '#f59e0b',
                    subsector: '#34d399',
                    engine: '#94a3b8'
                  };
                  const data = n.data as OctNodeData;
                  if ((data.type === 'sector' || data.type === 'subsector' || data.type === 'engine') && data.color) {
                    return colorPalette[data.color] || defaultPalette[data.type];
                  }
                  return defaultPalette[data.type] || '#1f2937';
                }}
                pannable
                zoomable
                className="bg-black/40 border border-white/10"
              />
              <Controls position="top-right" showFitView={false} className="!bg-black/40 !border-white/10" />
              <Background variant={BackgroundVariant.Dots} gap={18} size={2} color={gridDotColor} />
            </ReactFlow>
          </div>
        </div>
      </div>

      {isPortrait && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 rotate-message">
          <div className="bg-[#0f121a] border border-white/10 rounded-2xl p-6 max-w-md text-center space-y-3 shadow-2xl">
            <RotateCw className="w-10 h-10 mx-auto text-white" />
            <p className="text-lg font-semibold">Paysage requis</p>
            <p className="text-gray-400 text-sm">
              Tournez votre appareil en mode paysage pour manipuler confortablement l&apos;organigramme OCT.
            </p>
          </div>
        </div>
      )}

      {addDialog && addParentNode && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-[#0f121a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400">Ajouter sur</p>
                <h3 className="text-lg font-semibold text-white">{addParentNode.label}</h3>
              </div>
              <button onClick={() => setAddDialog(null)} className="text-gray-400 hover:text-white">
                ✕
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-300 font-semibold">Depuis l&apos;onglet Moyens</p>
                    <span className="text-[11px] text-gray-400">
                      {selectableMeans.length} dispo
                    </span>
                  </div>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {selectableMeans.length === 0 && (
                      <div className="text-sm text-gray-500 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                        Aucun moyen disponible. Ajoutez des moyens dans l&apos;onglet « Moyens ».
                      </div>
                    )}
                    {selectableMeans.map((m) => (
                      <div
                        key={m.name}
                        className="flex items-center justify-between px-3 py-2 rounded-xl border border-white/10 bg-white/5"
                      >
                        <div>
                          <div className="text-sm text-white">{m.name}</div>
                          <div className="text-[11px] text-gray-400 capitalize">{m.status === 'demande' ? 'Demandé' : 'Sur place'}</div>
                        </div>
                        <button
                          onClick={() => handleAddEngineFromMean(addDialog.parentId, m)}
                          className="px-3 py-2 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/40 transition"
                        >
                          Ajouter
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <p className="text-sm text-gray-300 font-semibold">Ajout manuel</p>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Intitulé</label>
                    <input
                      value={manualAdd.label}
                      onChange={(e) => setManualAdd({ ...manualAdd, label: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                      placeholder="Nom de l'engin ou groupe"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Statut</label>
                      <select
                        value={manualAdd.status}
                        onChange={(e) => setManualAdd({ ...manualAdd, status: e.target.value as 'sur_place' | 'demande' })}
                        className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                      >
                        <option value="sur_place">Sur place</option>
                        <option value="demande">Demandé</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Couleur</label>
                      <select
                        value={manualAdd.color}
                        onChange={(e) => setManualAdd({ ...manualAdd, color: e.target.value as OctColor })}
                        className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                      >
                        {COLOR_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold tracking-wide text-gray-400 uppercase whitespace-nowrap">Fréquence radio</label>
                    <input
                      value={manualAdd.freqUp}
                      onChange={(e) => setManualAdd({ ...manualAdd, freqUp: e.target.value, freqDown: '' })}
                      className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                      placeholder="218"
                    />
                  </div>
                  <div className="flex flex-wrap gap-3 justify-between">
                    {(addParentNode.type === 'sector' || addParentNode.type === 'subsector') && (
                      <button
                        onClick={handleAddSubsector}
                        className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-sm text-gray-200 transition"
                      >
                        + Sous-secteur
                      </button>
                    )}
                    <div className="flex gap-2 ml-auto">
                      <button
                        onClick={() => setAddDialog(null)}
                        className="px-4 py-2 rounded-xl bg-white/5 text-gray-300 hover:bg-white/10 transition"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={handleAddManualEngine}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition"
                      >
                        Ajouter l&apos;engin
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {editor && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-[#0f121a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400">Éditer la cellule</p>
                <h3 className="text-lg font-semibold text-white">{editor.label}</h3>
              </div>
              <button onClick={() => setEditor(null)} className="text-gray-400 hover:text-white">
                ✕
              </button>
            </div>
            <div className="p-4 space-y-5">
              <div>
                <label className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
                  {editor.type === 'cos' ? 'Nom du COS' : 'Intitulé'}
                </label>
                <input
                  value={editor.label}
                  onChange={(e) => setEditor({ ...editor, label: e.target.value })}
                  className="w-full mt-2 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                  placeholder="Ex: Secteur Appui"
                />
              </div>
              {canPickColor(editor.type) && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Chef de secteur</label>
                  <input
                    value={editor.chief}
                    onChange={(e) => setEditor({ ...editor, chief: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                    placeholder="Nom du chef"
                  />
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Type</label>
                  <select
                    value={editor.type}
                    onChange={(e) => {
                      const newType = e.target.value as OctNodeType;
                      setEditor({
                        ...editor,
                        type: newType,
                        color: canPickColor(newType) ? editor.color || 'red' : undefined
                      });
                    }}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                  >
                    <option value="codis">CODIS</option>
                    <option value="cos">COS</option>
                    <option value="sector">Secteur</option>
                    <option value="subsector">Sous-secteur</option>
                    <option value="engine">Engin</option>
                  </select>
                </div>
                {canPickColor(editor.type) && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Couleur</label>
                    <select
                      value={editor.color || 'red'}
                      onChange={(e) => setEditor({ ...editor, color: e.target.value as OctColor })}
                      className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                    >
                      {COLOR_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold tracking-wide text-gray-400 uppercase whitespace-nowrap">Fréquence montante</label>
                  <input
                    value={editor.freqUp}
                    onChange={(e) => setEditor({ ...editor, freqUp: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                    placeholder="218"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold tracking-wide text-gray-400 uppercase whitespace-nowrap">Fréquence descendante</label>
                  <input
                    value={editor.freqDown}
                    onChange={(e) => setEditor({ ...editor, freqDown: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                    placeholder="270"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Notes</label>
                <textarea
                  value={editor.notes}
                  onChange={(e) => setEditor({ ...editor, notes: e.target.value })}
                  className="w-full mt-2 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                  rows={3}
                  placeholder="Détails complémentaires, relais tactique, coordonnées..."
                />
              </div>
            </div>
            <div className="px-4 py-3 border-t border-white/10 flex justify-between gap-3 bg-black/20 flex-wrap">
              {canDeleteEditor && (
                <button
                  onClick={() => {
                    if (window.confirm('Supprimer cette carte et toutes ses branches ?')) {
                      handleDelete(editor.id);
                      setEditor(null);
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white transition border border-red-400/40"
                >
                  Supprimer
                </button>
              )}
              <div className="flex gap-3 ml-auto">
                <button
                  onClick={() => setEditor(null)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-gray-300 hover:bg-white/10 transition"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition"
                >
                  Valider
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OctDiagram;
