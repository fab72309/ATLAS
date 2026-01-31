import React, { useState, useEffect, useRef, useMemo } from 'react';
import { OrdreInitial, SimpleSectionItem } from '../types/soiec';
import { SpeechRecognitionService } from '../utils/speechRecognition';
import { DominanteType } from './DominantSelector';
import { DOCTRINE_CONTEXT } from '../constants/doctrine';
import { Sparkles, Mic, MicOff, PaintBucket } from 'lucide-react';
import { analyzeEmergency } from '../utils/openai';
import { logInterventionEvent } from '../utils/atlasTelemetry';
import { parseOrdreInitial } from '../utils/soiec';
import { useOctTree, type OctTreeNode } from '../utils/octTreeStore';

interface OrdreInitialViewProps {
  ordre: OrdreInitial | null;
  onChange?: (ordre: OrdreInitial) => void;
  hideToolbar?: boolean;
  dominante?: DominanteType;
  means?: { name: string; status: 'sur_place' | 'demande' }[];
  type?: 'group' | 'column' | 'site' | 'communication';
  boardRef?: React.RefObject<HTMLDivElement>;
  readOnly?: boolean;
  aiGenerateLabel?: string;
  interventionId?: string | null;
  aiEventType?: string;
}

// Types pour la gestion d'état locale
type CardKind = 'text' | 'objective' | 'separator' | 'empty';

interface CardItem {
  id: string;
  content: string;
  // Pour les idées de manœuvre
  mission?: string;
  moyen?: string;
  moyen_supp?: string;
  details?: string;
  color?: ItemColor;
  kind?: CardKind;
  objectiveId?: string | null;
  orderInObjective?: number;
}

interface ColumnData {
  id: keyof OrdreInitial;
  title: string;
  letter: string;
  color: string;
  items: CardItem[];
}

const safeRender = (content: unknown): string => {
  if (typeof content === 'string') return content;
  if (typeof content === 'number') return String(content);
  if (Array.isArray(content)) return content.map(c => safeRender(c)).join('\n');
  if (!content) return '';
  return JSON.stringify(content);
};

// Générateur d'ID unique simple
const generateId = () => Math.random().toString(36).substr(2, 9);

const DEFAULT_SECTOR_LABELS = new Set(['SECTEUR 1', 'SECTEUR 2', 'AIR / SOL', 'CRM']);

const findFirstCos = (node: OctTreeNode | null): OctTreeNode | null => {
  if (!node) return null;
  if (node.type === 'cos') return node;
  for (const child of node.children) {
    const found = findFirstCos(child);
    if (found) return found;
  }
  return null;
};

const DOCTRINE_DOMINANTE_MAP: Partial<Record<DominanteType, keyof typeof DOCTRINE_CONTEXT>> = {
  Incendie: 'incendie_structure',
  'Risque Gaz': 'fuite_gaz',
  'Accident de circulation': 'secours_routier',
  SMV: 'secours_personne_complexe',
  SUAP: 'secours_personne_complexe',
  NRBC: 'secours_personne_complexe',
  'Risque Chimique': 'fuite_gaz',
  'Risque Radiologique': 'secours_personne_complexe',
};

const ITEM_COLORS = ['red', 'green', 'violet', 'blue', 'orange'] as const;
type ItemColor = typeof ITEM_COLORS[number];

const ITEM_COLOR_OPTIONS: Array<{ value: ItemColor; label: string; className: string }> = [
  { value: 'red', label: 'Rouge', className: 'bg-red-500' },
  { value: 'green', label: 'Vert', className: 'bg-emerald-500' },
  { value: 'violet', label: 'Violet', className: 'bg-violet-500' },
  { value: 'blue', label: 'Bleu', className: 'bg-blue-500' },
  { value: 'orange', label: 'Orange', className: 'bg-orange-500' }
];

const ITEM_COLOR_BG_CLASSES: Record<ItemColor, string> = {
  red: 'bg-red-100/80 border-red-300/70 hover:bg-red-200/70 dark:bg-red-900/25 dark:border-red-500/30 dark:hover:bg-red-900/35',
  green: 'bg-emerald-100/80 border-emerald-300/70 hover:bg-emerald-200/70 dark:bg-emerald-900/25 dark:border-emerald-500/30 dark:hover:bg-emerald-900/35',
  violet: 'bg-violet-100/80 border-violet-300/70 hover:bg-violet-200/70 dark:bg-violet-900/25 dark:border-violet-500/30 dark:hover:bg-violet-900/35',
  blue: 'bg-blue-100/80 border-blue-300/70 hover:bg-blue-200/70 dark:bg-blue-900/25 dark:border-blue-500/30 dark:hover:bg-blue-900/35',
  orange: 'bg-orange-100/80 border-orange-300/70 hover:bg-orange-200/70 dark:bg-orange-900/25 dark:border-orange-500/30 dark:hover:bg-orange-900/35'
};

const ITEM_COLOR_TEXT_CLASSES: Record<ItemColor, string> = {
  red: 'text-red-900 dark:text-red-50',
  green: 'text-emerald-900 dark:text-emerald-50',
  violet: 'text-violet-900 dark:text-violet-50',
  blue: 'text-blue-900 dark:text-blue-50',
  orange: 'text-orange-900 dark:text-orange-50'
};

const ITEM_COLOR_DETAIL_CLASSES: Record<ItemColor, string> = {
  red: 'text-red-800/80 dark:text-red-100/70',
  green: 'text-emerald-800/80 dark:text-emerald-100/70',
  violet: 'text-violet-800/80 dark:text-violet-100/70',
  blue: 'text-blue-800/80 dark:text-blue-100/70',
  orange: 'text-orange-800/80 dark:text-orange-100/70'
};

const isItemColor = (value: unknown): value is ItemColor => (
  typeof value === 'string' && ITEM_COLORS.includes(value as ItemColor)
);

const AUTO_CLEAR_VALUES = new Set([
  'Nouvel élément',
  'Nouvel élément de situation',
  'Nouvel élément de commandement',
  "Nouvel élément d'anticipation",
  'Nouvel élément de logistique',
  'Nouvel objectif',
  'Nouvelle idée de manœuvre',
  'Nouvelle mission',
  'Moyen',
  'Renfort'
]);

const getColorAtIndex = (colors: unknown, index: number): ItemColor | undefined => {
  if (!colors) return undefined;
  if (Array.isArray(colors)) {
    const value = colors[index];
    return isItemColor(value) ? value : undefined;
  }
  if (typeof colors === 'object') {
    const record = colors as Record<string, unknown>;
    const value = record[String(index)];
    return isItemColor(value) ? value : undefined;
  }
  return undefined;
};

const PRIMARY_ADD_LABELS: Record<string, string> = {
  S: 'Ajouter un élément de situation',
  A: "Ajouter un élément d'anticipation",
  O: 'Ajouter un objectif',
  I: 'Ajouter une idée de manœuvre',
  E: 'Ajouter une mission',
  C: 'Ajouter un élément de commandement',
  L: 'Ajouter un élément de logistique'
};

const PRIMARY_PLACEHOLDERS: Record<string, string> = {
  S: 'Nouvel élément de situation',
  A: "Nouvel élément d'anticipation",
  O: 'Nouvel objectif',
  I: 'Nouvelle idée de manœuvre',
  C: 'Nouvel élément de commandement',
  L: 'Nouvel élément de logistique'
};

const getPrimaryAddLabel = (colId: string) => PRIMARY_ADD_LABELS[colId] ?? 'Ajouter un élément';
const getPrimaryPlaceholder = (colId: string) => PRIMARY_PLACEHOLDERS[colId] ?? 'Nouvel élément';

const buildColumnsFromOrdre = (
  ordre: OrdreInitial | null,
  useExtendedLayout: boolean
): Record<string, ColumnData> => {
  const sectionColors = ordre?._colors ?? {};
  const resolveItemKind = (record?: Record<string, unknown> | null): CardKind | undefined => {
    if (!record) return undefined;
    const rawKind = typeof record.type === 'string'
      ? record.type
      : typeof record.kind === 'string'
        ? record.kind
        : undefined;
    if (rawKind === 'separator' || rawKind === 'empty') return rawKind;
    if (rawKind === 'objective') return 'objective';
    if (rawKind === 'text') return 'text';
    return undefined;
  };
  const resolveObjectiveId = (record?: Record<string, unknown> | null): string | undefined => (
    record && typeof record.id === 'string' ? record.id : undefined
  );
  const processItems = (
    content: unknown,
    mode: 'simple' | 'idea' | 'execution' = 'simple',
    colors?: unknown,
    defaultKind: CardKind = 'text'
  ): CardItem[] => {
    if (!content) return [];
    if (Array.isArray(content)) {
      return content.map((item, index) => {
        const isPlainObject = item && typeof item === 'object' && !Array.isArray(item);
        const record = isPlainObject ? (item as Record<string, unknown>) : null;
        const fallbackColor = getColorAtIndex(colors, index);
        const recordKind = resolveItemKind(record);
        const objectiveId = resolveObjectiveId(record);
        if (recordKind === 'separator' || recordKind === 'empty') {
          return {
            id: generateId(),
            content: '',
            mission: '',
            moyen: '',
            moyen_supp: '',
            details: '',
            color: fallbackColor,
            kind: recordKind,
            objectiveId: undefined
          };
        }
        if (mode === 'execution') {
          const linkedObjectiveId = isPlainObject
            ? (typeof record?.objective_id === 'string'
              ? record.objective_id
              : typeof record?.objectiveId === 'string'
                ? record.objectiveId
                : undefined)
            : undefined;
          return {
            id: generateId(),
            content: '',
            mission: isPlainObject && typeof record?.mission === 'string' ? record.mission : safeRender(item),
            moyen: isPlainObject && typeof record?.moyen === 'string' ? record.moyen : undefined,
            moyen_supp: isPlainObject && typeof record?.moyen_supp === 'string' ? record.moyen_supp : undefined,
            details: isPlainObject && typeof record?.details === 'string' ? record.details : undefined,
            color: isPlainObject && isItemColor(record?.color) ? record.color : fallbackColor,
            kind: recordKind,
            objectiveId: linkedObjectiveId,
            orderInObjective: isPlainObject && typeof record?.order_in_objective === 'number' ? record.order_in_objective : undefined
          };
        }
        if (mode === 'idea') {
          const missionValue =
            isPlainObject && typeof record?.mission === 'string'
              ? record.mission
              : safeRender(item);
          const linkedObjectiveId = isPlainObject
            ? (typeof record?.objective_id === 'string'
              ? record.objective_id
              : typeof record?.objectiveId === 'string'
                ? record.objectiveId
                : undefined)
            : undefined;
          return {
            id: generateId(),
            content: missionValue,
            mission: isPlainObject && typeof record?.mission === 'string' ? record.mission : undefined,
            moyen: isPlainObject && typeof record?.moyen === 'string' ? record.moyen : undefined,
            moyen_supp: isPlainObject && typeof record?.moyen_supp === 'string' ? record.moyen_supp : undefined,
            details: isPlainObject && typeof record?.details === 'string' ? record.details : undefined,
            color: isPlainObject && isItemColor(record?.color) ? record.color : fallbackColor,
            kind: recordKind ?? defaultKind,
            objectiveId: linkedObjectiveId,
            orderInObjective: isPlainObject && typeof record?.order_in_objective === 'number' ? record.order_in_objective : undefined
          };
        }
        if (isPlainObject && typeof record?.content === 'string') {
          const resolvedObjectiveId = recordKind === 'objective'
            ? (objectiveId ?? generateId())
            : undefined;
          return {
            id: generateId(),
            content: record.content,
            color: fallbackColor,
            kind: recordKind ?? defaultKind,
            objectiveId: resolvedObjectiveId
          };
        }
        const resolvedObjectiveId = recordKind === 'objective'
          ? (objectiveId ?? generateId())
          : undefined;
        return {
          id: generateId(),
          content: safeRender(item),
          color: fallbackColor,
          kind: recordKind ?? defaultKind,
          objectiveId: resolvedObjectiveId
        };
      });
    }
    if (typeof content === 'string') {
      const lines = content.split('\n').filter(l => l.trim());
      return lines.map((line, index) => ({
        id: generateId(),
        content: line,
        color: getColorAtIndex(colors, index),
        kind: defaultKind,
        objectiveId: defaultKind === 'objective' ? generateId() : undefined
      }));
    }
    if (content && typeof content === 'object') {
      const record = content as Record<string, unknown>;
      const recordKind = resolveItemKind(record);
      const objectiveId = resolveObjectiveId(record);
      if (recordKind === 'separator' || recordKind === 'empty') {
        return [{
          id: generateId(),
          content: '',
          mission: '',
          moyen: '',
          moyen_supp: '',
          details: '',
          color: getColorAtIndex(colors, 0),
          kind: recordKind,
          objectiveId: undefined
        }];
      }
      if (typeof record.content === 'string') {
        const resolvedObjectiveId = recordKind === 'objective'
          ? (objectiveId ?? generateId())
          : undefined;
        return [{
          id: generateId(),
          content: record.content,
          color: getColorAtIndex(colors, 0),
          kind: recordKind ?? defaultKind,
          objectiveId: resolvedObjectiveId
        }];
      }
    }
    return [{
      id: generateId(),
      content: safeRender(content),
      color: getColorAtIndex(colors, 0),
      kind: defaultKind,
      objectiveId: defaultKind === 'objective' ? generateId() : undefined
    }];
  };

  if (!ordre) {
    return {
      S: { id: 'S', title: 'Situation', letter: 'S', color: 'slate', items: [] },
      ...(useExtendedLayout ? { A: { id: 'A', title: 'Anticipation', letter: 'A', color: 'slate', items: [] } } : {}),
      O: { id: 'O', title: 'Objectif', letter: 'O', color: 'slate', items: [] },
      I: { id: 'I', title: 'Idée de manœuvre', letter: 'I', color: 'slate', items: [] },
      E: { id: 'E', title: 'Exécution', letter: 'E', color: 'slate', items: [] },
      C: { id: 'C', title: 'Commandement', letter: 'C', color: 'slate', items: [] },
      ...(useExtendedLayout ? { L: { id: 'L', title: 'Logistique', letter: 'L', color: 'slate', items: [] } } : {})
    };
  }

  return {
    S: { id: 'S', title: 'Situation', letter: 'S', color: 'slate', items: processItems(ordre.S, 'simple', sectionColors.S, 'text') },
    ...(useExtendedLayout
      ? { A: { id: 'A', title: 'Anticipation', letter: 'A', color: 'slate', items: processItems(ordre.A, 'simple', sectionColors.A, 'text') } }
      : {}),
    O: { id: 'O', title: 'Objectif', letter: 'O', color: 'slate', items: processItems(ordre.O, 'simple', sectionColors.O, 'objective') },
    I: { id: 'I', title: 'Idée de manœuvre', letter: 'I', color: 'slate', items: processItems(ordre.I, 'idea', sectionColors.I) },
    E: { id: 'E', title: 'Exécution', letter: 'E', color: 'slate', items: processItems(ordre.E, 'execution', sectionColors.E) },
    C: { id: 'C', title: 'Commandement', letter: 'C', color: 'slate', items: processItems(ordre.C, 'simple', sectionColors.C, 'text') },
    ...(useExtendedLayout
      ? { L: { id: 'L', title: 'Logistique', letter: 'L', color: 'slate', items: processItems(ordre.L, 'simple', sectionColors.L, 'text') } }
      : {})
  };
};

const OrdreInitialView: React.FC<OrdreInitialViewProps> = ({
  ordre,
  onChange,
  hideToolbar = false,
  dominante,
  means = [],
  type = 'group',
  boardRef,
  readOnly = false,
  aiGenerateLabel = "Générer ordre initial avec l'IA",
  interventionId = null,
  aiEventType
}) => {
  const [columns, setColumns] = useState<Record<string, ColumnData>>({});
  const [draggedItem, setDraggedItem] = useState<{ id: string, sourceCol: string } | null>(null);
  const [editingItem, setEditingItem] = useState<{ id: string, colId: string, content: string, mission?: string, moyen?: string, moyen_supp?: string, details?: string, color?: ItemColor, kind?: CardKind } | null>(null);
  const [addModal, setAddModal] = useState<{ colId: string } | null>(null);
  const [activeObjectiveId, setActiveObjectiveId] = useState<string | null>(null);
  const [ideaNumberEditor, setIdeaNumberEditor] = useState<{ id: string; value: string } | null>(null);
  const [ideaNumberError, setIdeaNumberError] = useState<string | null>(null);
  const [activeColorPickerId, setActiveColorPickerId] = useState<string | null>(null);
  const ideaNumberPopoverRef = useRef<HTMLDivElement | null>(null);
  const { tree: octTree } = useOctTree();
  const skipPropSyncRef = useRef(false);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const speechServiceRef = useRef<SpeechRecognitionService | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const doctrineKey = useMemo(
    () => (dominante ? DOCTRINE_DOMINANTE_MAP[dominante] : undefined),
    [dominante]
  );
  const doctrineData = doctrineKey ? DOCTRINE_CONTEXT[doctrineKey] : null;
  const useExtendedLayout = type === 'column' || type === 'site';
  const soiecLabel = useMemo(
    () => (useExtendedLayout ? 'SAOIECL' : 'SOIEC'),
    [useExtendedLayout]
  );
  const getObjectiveIds = React.useCallback((cols: Record<string, ColumnData> = columns) => {
    const items = cols.O?.items ?? [];
    return items
      .filter((item) => item.kind === 'objective')
      .map((item) => item.objectiveId ?? item.id);
  }, [columns]);
  const objectiveOrder = useMemo(() => getObjectiveIds(columns), [columns, getObjectiveIds]);
  const objectiveIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    objectiveOrder.forEach((id, index) => {
      map.set(id, index + 1);
    });
    return map;
  }, [objectiveOrder]);
  const { sectorOptions, hasSectorOptions } = useMemo(() => {
    if (!octTree) return { sectorOptions: [] as Array<{ id: string; label: string }>, hasSectorOptions: false };
    const cosNode = findFirstCos(octTree);
    if (!cosNode) return { sectorOptions: [] as Array<{ id: string; label: string }>, hasSectorOptions: false };
    const options: Array<{ id: string; label: string }> = [];
    cosNode.children
      .filter((child) => child.type === 'sector')
      .forEach((sector) => {
        const label = (sector.label || 'Secteur').trim();
        const normalized = label.toUpperCase();
        const hasChildren = sector.children.some((child) => child.type === 'subsector' || child.type === 'engine');
        const isDefault = DEFAULT_SECTOR_LABELS.has(normalized);
        const includeSector = hasChildren || !isDefault;
        if (!includeSector) return;
        options.push({ id: sector.id, label });
        sector.children
          .filter((child) => child.type === 'subsector')
          .forEach((sub) => {
            const subLabel = (sub.label || 'Sous-secteur').trim();
            options.push({ id: sub.id, label: `${subLabel} (${label})` });
          });
      });
    return { sectorOptions: options, hasSectorOptions: options.length > 0 };
  }, [octTree]);
  const ideaQuickPicks = useMemo(() => {
    const items = columns.I?.items ?? [];
    const picks: Array<{ id: string; label: string; content: string }> = [];
    const counters: Record<string, number> = {};
    let unlinkedCounter = 0;
    items.forEach((item) => {
      if (item.kind === 'separator' || item.kind === 'empty') return;
      const content = (item.content || item.mission || '').trim();
      if (!content) return;
      const objectiveId = item.objectiveId ?? undefined;
      const objectiveIndex = objectiveId ? objectiveIndexMap.get(objectiveId) : undefined;
      let label: string;
      if (objectiveId && objectiveIndex) {
        counters[objectiveId] = (counters[objectiveId] ?? 0) + 1;
        label = `${objectiveIndex}.${counters[objectiveId]}`;
      } else {
        unlinkedCounter += 1;
        label = `NL.${unlinkedCounter}`;
      }
      picks.push({ id: item.id, label, content });
    });
    return picks;
  }, [columns.I?.items, objectiveIndexMap]);
  const moyenQuickPicks = useMemo(() => {
    if (hasSectorOptions) {
      return sectorOptions.map((option) => ({
        label: option.label,
        type: 'sector' as const
      }));
    }
    return (means ?? []).map((mean) => ({
      label: mean.name,
      type: 'engine' as const,
      status: mean.status
    }));
  }, [hasSectorOptions, sectorOptions, means]);

  // Initialisation des données
  useEffect(() => {
    if (skipPropSyncRef.current) {
      // We triggered the parent update ourselves; avoid re-initialising and clear the flag.
      skipPropSyncRef.current = false;
      return;
    }

    setColumns(buildColumnsFromOrdre(ordre, useExtendedLayout));
  }, [ordre, useExtendedLayout]);

  // Notify parent of changes
  useEffect(() => {
    if (!onChange) return;

    const buildColorList = (items: CardItem[] | undefined) =>
      (items ?? []).map((item) => (item.color ? item.color : null));

    const serializeSimpleItems = (items: CardItem[] | undefined): SimpleSectionItem[] => (
      (items ?? []).map((item) => {
        if (item.kind === 'separator') return { type: 'separator' };
        if (item.kind === 'empty') return { type: 'empty' };
        const content = item.content ?? '';
        if (item.kind === 'objective') {
          const id = item.objectiveId ?? item.id;
          return { type: 'objective', id, content };
        }
        return content;
      })
    );

    // Convert columns back to OrdreInitial format
    const situationItems = serializeSimpleItems(columns.S?.items);
    const anticipationItems = serializeSimpleItems(columns.A?.items);
    const commandItems = serializeSimpleItems(columns.C?.items);
    const logistiqueItems = serializeSimpleItems(columns.L?.items);
    const ideeOrderByObjective: Record<string, number> = {};
    const ordreData: OrdreInitial = {
      S: situationItems,
      ...(useExtendedLayout ? { A: anticipationItems } : {}),
      O: serializeSimpleItems(columns.O?.items),
      I: columns.I?.items?.map(i => {
        if (i.kind === 'separator' || i.kind === 'empty') {
          return {
            mission: '',
            moyen: '',
            moyen_supp: '',
            details: '',
            color: i.color,
            type: i.kind
          };
        }
        const objectiveId = i.objectiveId ?? undefined;
        let orderInObjective: number | undefined;
        if (objectiveId) {
          ideeOrderByObjective[objectiveId] = (ideeOrderByObjective[objectiveId] ?? 0) + 1;
          orderInObjective = ideeOrderByObjective[objectiveId];
        }
        return {
          mission: i.content || i.mission || '',
          moyen: i.moyen || '',
          moyen_supp: i.moyen_supp || '',
          details: i.details || '',
          color: i.color,
          type: i.kind === 'separator' || i.kind === 'empty' ? i.kind : undefined,
          objective_id: objectiveId,
          order_in_objective: orderInObjective
        };
      }) || [],
      E: columns.E?.items?.map(i => ({
        mission: i.mission || '',
        moyen: i.moyen || '',
        moyen_supp: i.moyen_supp || '',
        details: i.details || '',
        color: i.color,
        type: i.kind === 'separator' || i.kind === 'empty' ? i.kind : undefined
      })) || [],
      C: commandItems,
      ...(useExtendedLayout ? { L: logistiqueItems } : {})
    };

    const colors = {
      S: buildColorList(columns.S?.items),
      O: buildColorList(columns.O?.items),
      I: buildColorList(columns.I?.items),
      E: buildColorList(columns.E?.items),
      C: buildColorList(columns.C?.items),
      ...(useExtendedLayout ? { A: buildColorList(columns.A?.items) } : {}),
      ...(useExtendedLayout ? { L: buildColorList(columns.L?.items) } : {})
    };
    const hasColors = Object.values(colors).some((list) => Array.isArray(list) && list.some(Boolean));
    if (hasColors) {
      ordreData._colors = colors;
    }

    onChange(ordreData);
    skipPropSyncRef.current = true;
  }, [columns, onChange, useExtendedLayout]);

  // Nettoyer la reconnaissance à la fermeture de la modal
  useEffect(() => {
    return () => {
      if (speechServiceRef.current) {
        speechServiceRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    if (readOnly && editingItem) {
      setEditingItem(null);
    }
  }, [readOnly, editingItem]);


  useEffect(() => {
    const objectiveIds = getObjectiveIds(columns);
    if (objectiveIds.length === 0) {
      if (activeObjectiveId) setActiveObjectiveId(null);
      return;
    }
    if (!activeObjectiveId || !objectiveIds.includes(activeObjectiveId)) {
      setActiveObjectiveId(objectiveIds[objectiveIds.length - 1]);
    }
  }, [columns, activeObjectiveId, getObjectiveIds]);

  // Gestion du Drag & Drop
  const handleDragStart = (e: React.DragEvent, id: string, sourceCol: string) => {
    if (readOnly) return;
    setDraggedItem({ id, sourceCol });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetColId: string, targetItemId?: string) => {
    e.preventDefault();
    if (readOnly) return;
    if (!draggedItem) return;

    const sourceCol = columns[draggedItem.sourceCol];
    const targetCol = columns[targetColId];
    const itemToMove = sourceCol.items.find(i => i.id === draggedItem.id);

    if (!itemToMove) return;

    // Retirer de la source
    const newSourceItems = sourceCol.items.filter(i => i.id !== draggedItem.id);

    // Ajouter à la cible
    let newTargetItems = [...targetCol.items];
    if (draggedItem.sourceCol === targetColId) {
      newTargetItems = newSourceItems; // Si même colonne, on part de la liste filtrée
    }

    if (targetItemId) {
      // Insertion avant l'élément cible
      const targetIndex = newTargetItems.findIndex(i => i.id === targetItemId);
      if (targetIndex !== -1) {
        newTargetItems.splice(targetIndex, 0, itemToMove);
      } else {
        newTargetItems.push(itemToMove);
      }
    } else {
      // Ajout à la fin si pas de cible spécifique (drop sur la colonne)
      newTargetItems.push(itemToMove);
    }

    setColumns(prev => ({
      ...prev,
      [draggedItem.sourceCol]: {
        ...sourceCol,
        items: newSourceItems
      },
      [targetColId]: {
        ...targetCol,
        items: newTargetItems
      }
    }));
    setDraggedItem(null);
  };

  // Gestion de l'ajout
  const handleAddItem = (colId: string, kind: 'objective' | 'separator' | 'empty') => {
    if (readOnly) return;
    const isExecution = colId === 'E';
    const isIdea = colId === 'I';
    const resolvedKind: CardKind = kind === 'separator'
      ? 'separator'
      : kind === 'empty'
        ? 'empty'
        : colId === 'O'
          ? 'objective'
          : 'text';
    const isSpecial = resolvedKind === 'separator' || resolvedKind === 'empty';
    const primaryPlaceholder = getPrimaryPlaceholder(colId);
    const resolvedObjectiveId = resolvedKind === 'objective'
      ? generateId()
      : isIdea
        ? (activeObjectiveId ?? getObjectiveIds().slice(-1)[0])
        : undefined;
    const objectiveColor = isIdea && resolvedObjectiveId
      ? columns.O?.items.find((item) => (item.objectiveId ?? item.id) === resolvedObjectiveId)?.color
      : undefined;
    const newItem: CardItem = {
      id: generateId(),
      content: isExecution
        ? ''
        : isIdea
          ? (isSpecial ? '' : primaryPlaceholder)
          : isSpecial
            ? ''
            : primaryPlaceholder,
      mission: isExecution ? (isSpecial ? '' : 'Nouvelle mission') : undefined,
      moyen: isExecution ? (isSpecial ? '' : 'Moyen') : undefined,
      moyen_supp: isExecution ? (isSpecial ? '' : 'Renfort') : undefined,
      color: isIdea && !isSpecial ? objectiveColor : undefined,
      kind: resolvedKind,
      objectiveId: resolvedObjectiveId ?? undefined
    };

    setColumns(prev => {
      const column = prev[colId];
      if (!column) return prev;
      let nextItems = [...column.items, newItem];
      if (isIdea && resolvedObjectiveId) {
        let insertIndex = nextItems.length - 1;
        let lastMatchIndex = -1;
        for (let i = 0; i < nextItems.length - 1; i += 1) {
          const item = nextItems[i];
          if (item.kind === 'separator' || item.kind === 'empty') continue;
          if (item.objectiveId === resolvedObjectiveId) {
            lastMatchIndex = i;
          }
        }
        if (lastMatchIndex !== -1) {
          insertIndex = lastMatchIndex + 1;
          nextItems.splice(nextItems.length - 1, 1);
          nextItems.splice(insertIndex, 0, newItem);
        }
      }
      return {
        ...prev,
        [colId]: {
          ...column,
          items: nextItems
        }
      };
    });

    if (resolvedKind === 'objective' && resolvedObjectiveId) {
      setActiveObjectiveId(resolvedObjectiveId);
    }

    // Ouvrir directement l'édition
    if (!isSpecial) {
      setEditingItem({
        id: newItem.id,
        colId,
        content: newItem.content,
        mission: newItem.mission,
        moyen: newItem.moyen,
        moyen_supp: newItem.moyen_supp,
        color: newItem.color,
        kind: newItem.kind
      });
    }
  };

  // Gestion de l'édition
  const handleSaveEdit = () => {
    if (readOnly) return;
    if (!editingItem) return;
    const hasContent = editingItem.content.trim().length > 0;
    const resolvedKind = editingItem.kind === 'empty' && hasContent
      ? (editingItem.colId === 'O' ? 'objective' : 'text')
      : editingItem.kind;
    setColumns(prev => ({
      ...prev,
      [editingItem.colId]: {
        ...prev[editingItem.colId],
        items: prev[editingItem.colId].items.map(item =>
          item.id === editingItem.id
            ? {
                ...item,
                content: editingItem.content,
                mission: editingItem.mission,
                moyen: editingItem.moyen,
                moyen_supp: editingItem.moyen_supp,
                details: editingItem.details,
                color: editingItem.color ?? item.color,
                kind: resolvedKind
              }
            : item
        )
      }
    }));
    setEditingItem(null);
  };

  const handleSetItemColor = React.useCallback((colId: string, itemId: string, color: ItemColor) => {
    setColumns(prev => {
      const column = prev[colId];
      if (!column) return prev;
      return {
        ...prev,
        [colId]: {
          ...column,
          items: column.items.map(item => {
            if (item.id !== itemId) return item;
            const nextColor = item.color === color ? undefined : color;
            return { ...item, color: nextColor };
          })
        }
      };
    });
    setEditingItem(prev => {
      if (!prev || prev.id !== itemId) return prev;
      const nextColor = prev.color === color ? undefined : color;
      return { ...prev, color: nextColor };
    });
    setActiveColorPickerId(null);
  }, []);

  // Dictée vocale pour la modal
  const ensureSpeechService = React.useCallback(() => {
    if (!speechServiceRef.current) {
      speechServiceRef.current = new SpeechRecognitionService();
    }
    return speechServiceRef.current;
  }, []);

  const stopDictation = React.useCallback(() => {
    ensureSpeechService().stop();
    setIsListening(false);
  }, [ensureSpeechService]);

  const startDictation = React.useCallback((target: 'content' | 'mission') => {
    const service = ensureSpeechService();
    if (!editingItem) return;
    setSpeechError(null);
    setEditingItem((prev) => {
      if (!prev) return prev;
      const value = target === 'content' ? prev.content : prev.mission ?? '';
      if (!AUTO_CLEAR_VALUES.has(value)) return prev;
      return { ...prev, [target]: '' };
    });

    if (!service.isRecognitionSupported()) {
      setSpeechError('La reconnaissance vocale n\'est pas supportée par votre navigateur.');
      return;
    }

    service.start({
      onStart: () => setIsListening(true),
      onEnd: () => setIsListening(false),
      onError: (err) => {
        setIsListening(false);
        setSpeechError(err.message || 'Erreur de dictée');
      },
      onResult: (text) => {
        setEditingItem((prev) => {
          if (!prev) return prev;
          if (target === 'content') {
            return { ...prev, content: text };
          }
          return { ...prev, mission: text };
        });
      }
    });
  }, [editingItem, ensureSpeechService]);

  useEffect(() => {
    if (!editingItem) {
      stopDictation();
      setSpeechError(null);
    }
  }, [editingItem, stopDictation]);

  const handleDelete = (colId: string, itemId: string) => {
    if (readOnly) return;
    setColumns(prev => {
      const column = prev[colId];
      if (!column) return prev;
      let deletedObjectiveId: string | undefined;
      if (colId === 'O') {
        const target = column.items.find((item) => item.id === itemId);
        if (target?.kind === 'objective') {
          deletedObjectiveId = target.objectiveId ?? target.id;
        }
      }
      const nextColumnItems = column.items.filter(i => i.id !== itemId);
      const nextState: Record<string, ColumnData> = {
        ...prev,
        [colId]: {
          ...column,
          items: nextColumnItems
        }
      };
      if (deletedObjectiveId && prev.I) {
        nextState.I = {
          ...prev.I,
          items: prev.I.items.map((item) => (
            item.objectiveId === deletedObjectiveId ? { ...item, objectiveId: undefined } : item
          ))
        };
      }
      return nextState;
    });
  };

  const applyIdeaNumber = React.useCallback((itemId: string, rawValue: string) => {
    const cleaned = rawValue.trim();
    const match = cleaned.match(/^(\d+)\.(\d+)$/);
    if (!match) {
      setIdeaNumberError('Format attendu : 1.1');
      return false;
    }
    const objectiveIndex = Number(match[1]);
    const orderIndex = Number(match[2]);
    if (!Number.isFinite(objectiveIndex) || !Number.isFinite(orderIndex) || objectiveIndex < 1 || orderIndex < 1) {
      setIdeaNumberError('Numéro invalide.');
      return false;
    }

    let applied = false;
    let nextActiveObjectiveId: string | null = null;
    setColumns(prev => {
      const objectiveIds = (prev.O?.items ?? [])
        .filter((item) => item.kind === 'objective')
        .map((item) => item.objectiveId ?? item.id);
      const targetObjectiveId = objectiveIds[objectiveIndex - 1];
      if (!targetObjectiveId || !prev.I) {
        setIdeaNumberError('Objectif introuvable.');
        return prev;
      }
      const targetObjectiveColor = prev.O?.items.find(
        (item) => (item.objectiveId ?? item.id) === targetObjectiveId
      )?.color;
      nextActiveObjectiveId = targetObjectiveId;

      const items = [...prev.I.items];
      const currentIndex = items.findIndex((item) => item.id === itemId);
      if (currentIndex === -1) return prev;

      const [moved] = items.splice(currentIndex, 1);
      const updatedMoved = {
        ...moved,
        objectiveId: targetObjectiveId,
        color: moved.color ?? targetObjectiveColor
      };

      let count = 0;
      let insertIndex = items.length;
      let lastMatchIndex = -1;
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        if (item.kind === 'separator' || item.kind === 'empty') continue;
        if (item.objectiveId === targetObjectiveId) {
          count += 1;
          lastMatchIndex = i;
          if (count >= orderIndex) {
            insertIndex = i;
            break;
          }
        }
      }
      if (count < orderIndex && lastMatchIndex !== -1) {
        insertIndex = lastMatchIndex + 1;
      }
      items.splice(insertIndex, 0, updatedMoved);
      applied = true;
      return {
        ...prev,
        I: {
          ...prev.I,
          items
        }
      };
    });

    if (applied) {
      if (nextActiveObjectiveId) {
        setActiveObjectiveId(nextActiveObjectiveId);
      }
      setIdeaNumberError(null);
    }
    return applied;
  }, [setActiveObjectiveId]);

  useEffect(() => {
    if (!ideaNumberEditor) return undefined;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (ideaNumberPopoverRef.current?.contains(target)) return;
      if (target.closest('[data-idea-number-trigger="true"]')) return;

      const trimmed = ideaNumberEditor.value.trim();
      if (!trimmed) {
        setIdeaNumberEditor(null);
        setIdeaNumberError(null);
        return;
      }
      const applied = applyIdeaNumber(ideaNumberEditor.id, ideaNumberEditor.value);
      if (applied) setIdeaNumberEditor(null);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [ideaNumberEditor, applyIdeaNumber]);

  const handleGenerateAI = async () => {
    if (readOnly) return;
    const situationText = (columns.S?.items || [])
      .filter((item) => item.kind !== 'separator' && item.kind !== 'empty')
      .map((item) => item.content)
      .filter((item) => item.trim())
      .join('\n')
      .trim();
    if (!situationText) {
      alert('Ajoutez une situation avant de générer avec l’IA.');
      return;
    }
    setIsGeneratingAI(true);
    try {
      const meansText = means.length ? `Moyens disponibles: ${means.map(m => `${m.name} (${m.status})`).join(', ')}` : '';
      const response = await analyzeEmergency(
        situationText,
        type || 'group',
        {
          dominante: dominante || 'Incendie',
          extraContext: meansText
        }
      );

      const parsed = parseOrdreInitial(typeof response === 'string' ? response : JSON.stringify(response));
      if (interventionId && aiEventType) {
        const aiPayload = {
          soiec_type: soiecLabel,
          command_level_key: type,
          input: {
            situation: situationText,
            dominante: dominante || null,
            moyens: means.map((m) => ({ name: m.name, status: m.status }))
          },
          output: {
            raw: response,
            parsed
          }
        };
        void logInterventionEvent(
          interventionId,
          aiEventType,
          aiPayload,
          { source: 'template', ui_context: 'soiec.ai', edit_count: 1 },
          { ai_generate_label: aiGenerateLabel }
        ).catch((error) => {
          console.error('[telemetry] Failed to log AI output', error);
        });
      }
      setColumns(buildColumnsFromOrdre(parsed, useExtendedLayout));
      skipPropSyncRef.current = true;
    } catch (error) {
      console.error('Erreur génération IA:', error);
      const message = error instanceof Error ? error.message : 'Impossible de générer l’ordre via l’IA pour le moment.';
      alert(message);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const getSuggestions = React.useCallback((colId: string, query: string) => {
    if (!doctrineData) return [];
    const base: string[] =
      colId === 'O'
        ? doctrineData.objectifs || []
        : (colId === 'I' || colId === 'E')
          ? doctrineData.idees_manoeuvre || []
          : [];
    if (!base.length) return [];
    const q = query.trim().toLowerCase();
    const filtered = q
      ? base.filter((item: string) => item.toLowerCase().includes(q))
      : base;
    return filtered.slice(0, 6);
  }, [doctrineData]);

  const suggestions = useMemo(() => {
    if (!editingItem) return [];
    const query = editingItem.colId === 'E'
      ? editingItem.mission || ''
      : editingItem.content || '';
    return getSuggestions(editingItem.colId, query);
  }, [editingItem, getSuggestions]);

  const clearAutoPlaceholder = React.useCallback((field: 'content' | 'mission' | 'moyen') => {
    setEditingItem((prev) => {
      if (!prev) return prev;
      const value = field === 'content'
        ? prev.content
        : field === 'mission'
          ? prev.mission ?? ''
          : prev.moyen ?? '';
      if (!AUTO_CLEAR_VALUES.has(value)) return prev;
      return { ...prev, [field]: '' };
    });
  }, []);

  const stripAutoPlaceholder = React.useCallback((prevValue: string | undefined, nextValue: string) => {
    if (!prevValue || !AUTO_CLEAR_VALUES.has(prevValue)) return nextValue;
    if (nextValue === prevValue) return '';
    const stripped = nextValue.includes(prevValue) ? nextValue.replace(prevValue, '') : nextValue;
    return stripped.trimStart();
  }, []);

  // Rendu d'une carte
  const renderCard = (
    item: CardItem,
    col: ColumnData,
    options?: { objectiveIndex?: number; ideaNumberLabel?: string; showUnlinkedHeader?: boolean; isActiveObjective?: boolean }
  ) => {
    const isExecution = col.id === 'E';
    const isSeparator = item.kind === 'separator';
    const isEmpty = item.kind === 'empty';
    const objectiveIndex = options?.objectiveIndex;
    const ideaNumberLabel = options?.ideaNumberLabel;
    const showUnlinkedHeader = options?.showUnlinkedHeader;
    const isActiveObjective = options?.isActiveObjective;
    const missionTextClass = 'text-slate-700 dark:text-slate-100';
    const detailTextClass = 'text-slate-600/80 dark:text-slate-200/70';
    const missionValue = item.mission || item.content;
    const ideaContent = item.content || item.mission || '';
    const bgColor = {
      blue: 'bg-blue-50/80 border-blue-200/70 hover:bg-blue-100/70 dark:bg-blue-900/20 dark:border-blue-500/30 dark:hover:bg-blue-900/30',
      green: 'bg-green-50/80 border-green-200/70 hover:bg-green-100/70 dark:bg-green-900/20 dark:border-green-500/30 dark:hover:bg-green-900/30',
      yellow: 'bg-yellow-50/80 border-yellow-200/70 hover:bg-yellow-100/70 dark:bg-yellow-900/20 dark:border-yellow-500/30 dark:hover:bg-yellow-900/30',
      red: 'bg-red-50/80 border-red-200/70 hover:bg-red-100/70 dark:bg-red-900/20 dark:border-red-500/30 dark:hover:bg-red-900/30',
      purple: 'bg-purple-50/80 border-purple-200/70 hover:bg-purple-100/70 dark:bg-purple-900/20 dark:border-purple-500/30 dark:hover:bg-purple-900/30',
      slate: 'bg-slate-50/80 border-slate-200/70 hover:bg-slate-100/70 dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/10',
      teal: 'bg-teal-50/80 border-teal-200/70 hover:bg-teal-100/70 dark:bg-teal-900/20 dark:border-teal-500/30 dark:hover:bg-teal-900/30',
      orange: 'bg-orange-50/80 border-orange-200/70 hover:bg-orange-100/70 dark:bg-orange-900/20 dark:border-orange-500/30 dark:hover:bg-orange-900/30'
    }[col.color];
    const resolvedBgColor = isSeparator
      ? 'bg-transparent border-transparent'
      : isEmpty
        ? 'bg-slate-100/70 border-slate-200/70 dark:bg-white/10 dark:border-white/15'
        : item.color
          ? ITEM_COLOR_BG_CLASSES[item.color]
          : bgColor;
    const resolvedMissionClass = item.color ? ITEM_COLOR_TEXT_CLASSES[item.color] : missionTextClass;
    const resolvedDetailClass = item.color ? ITEM_COLOR_DETAIL_CLASSES[item.color] : detailTextClass;
    const resolvedContentClass = item.color ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-gray-100';

    return (
      <div
        key={item.id}
        draggable={!readOnly}
        onDragStart={(e) => handleDragStart(e, item.id, col.id)}
        onDragOver={handleDragOver}
        onDrop={(e) => {
          if (readOnly) return;
          e.stopPropagation(); // Empêcher le drop sur la colonne
          handleDrop(e, col.id, item.id);
        }}
        onClick={() => {
          if (col.id === 'O' && item.kind === 'objective') {
            setActiveObjectiveId(item.objectiveId ?? item.id);
          }
          if (col.id === 'I' && item.objectiveId) {
            setActiveObjectiveId(item.objectiveId);
          }
        }}
        className={`p-3 rounded-lg border backdrop-blur-sm transition-all duration-200 group relative shadow-sm dark:shadow-none ${resolvedBgColor} mb-2 ${readOnly ? 'cursor-default' : 'cursor-move'} z-0 hover:z-20 focus-within:z-20 ${isActiveObjective ? 'ring-2 ring-blue-400/60 dark:ring-blue-300/60' : ''}`}
      >
        {showUnlinkedHeader && (
          <div className="mb-2 text-[10px] uppercase tracking-[0.3em] text-slate-400 dark:text-white/40">
            Non lié
          </div>
        )}
        {ideaNumberLabel && (
          <div className="absolute -top-2 left-2 z-30">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                if (readOnly) return;
                const initialValue = /^\d+\.\d+$/.test(ideaNumberLabel) ? ideaNumberLabel : '';
                setIdeaNumberEditor({ id: item.id, value: initialValue });
                setIdeaNumberError(null);
              }}
              data-idea-number-trigger="true"
              className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-900 text-white shadow"
              title="Modifier le numéro"
            >
              {ideaNumberLabel}
            </button>
          </div>
        )}
        {ideaNumberEditor?.id === item.id && !readOnly && (
          <div
            ref={ideaNumberPopoverRef}
            className="absolute top-2 left-2 z-40 bg-white dark:bg-[#0f121a] border border-slate-200 dark:border-white/10 rounded-lg p-2 shadow-lg min-w-[110px]"
          >
            <input
              value={ideaNumberEditor.value}
              onChange={(event) => {
                setIdeaNumberEditor((prev) => (prev ? { ...prev, value: event.target.value } : prev));
                if (ideaNumberError) setIdeaNumberError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  const applied = applyIdeaNumber(item.id, ideaNumberEditor.value);
                  if (applied) setIdeaNumberEditor(null);
                }
                if (event.key === 'Escape') {
                  setIdeaNumberEditor(null);
                  setIdeaNumberError(null);
                }
              }}
              onBlur={() => {
                if (!ideaNumberEditor) return;
                const applied = applyIdeaNumber(item.id, ideaNumberEditor.value);
                if (applied) setIdeaNumberEditor(null);
              }}
              placeholder="1.1"
              className="w-full text-xs px-2 py-1 border border-slate-200 dark:border-white/10 rounded bg-white/90 dark:bg-black/30 text-slate-800 dark:text-slate-100 focus:outline-none"
            />
            {ideaNumberError && (
              <div className="mt-1 text-[10px] text-red-500">{ideaNumberError}</div>
            )}
          </div>
        )}
        <div className="pr-8"> {/* Padding droit pour éviter le chevauchement avec les boutons */}
          {isSeparator ? (
            <div className="w-full border-t border-slate-200/80 dark:border-white/10" />
          ) : isEmpty ? (
            <div className="min-h-[20px]" />
          ) : isExecution ? (
            <div className="space-y-1">
              <div className={`font-bold ${resolvedMissionClass}`}>{missionValue}</div>
              <div className={`text-xs ${resolvedDetailClass}`}>
                {item.moyen && <div>Moyen: {item.moyen}</div>}
                {item.moyen_supp && item.moyen_supp.trim() && item.moyen_supp.trim().toLowerCase() !== 'renfort' && (
                  <div>Renfort: {item.moyen_supp}</div>
                )}
              </div>
            </div>
          ) : (
            <div className={`${resolvedContentClass} text-sm whitespace-pre-wrap`}>
              {typeof objectiveIndex === 'number' && (
                <span className="font-semibold mr-1">{objectiveIndex}.</span>
              )}
              {col.id === 'I' ? ideaContent : item.content}
            </div>
          )}
        </div>

        {/* Actions (Edit/Delete) - Plus gros et positionnés */}
        {!readOnly && (
          <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 border border-slate-200 rounded p-1 shadow-sm backdrop-blur-md dark:bg-black/40 dark:border-transparent dark:shadow-none z-30">
            {!isSeparator && (
              <div className="relative">
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    setActiveColorPickerId((prev) => (prev === item.id ? null : item.id));
                  }}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/20 rounded text-slate-600 dark:text-slate-200 transition-colors"
                  title="Couleur"
                  aria-label="Modifier la couleur"
                >
                  <PaintBucket className="w-4 h-4" />
                </button>
                {activeColorPickerId === item.id && (
                  <div className="absolute right-full top-0 mr-2 bg-white dark:bg-[#0f121a] border border-slate-200 dark:border-white/10 rounded-lg p-1 shadow-lg flex items-center gap-1">
                    {ITEM_COLOR_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleSetItemColor(col.id, item.id, option.value);
                        }}
                        className={`w-6 h-6 rounded-full border border-white/70 ${option.className} ${item.color === option.value ? 'ring-2 ring-slate-900/60 dark:ring-white/70' : ''}`}
                        title={option.label}
                        aria-label={`Couleur ${option.label}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
            {!isSeparator && (
              <button
                onClick={() => {
                  setActiveColorPickerId(null);
                  if (col.id === 'O' && item.kind === 'objective') {
                    setActiveObjectiveId(item.objectiveId ?? item.id);
                  }
                  setEditingItem({
                    id: item.id,
                    colId: col.id,
                    content: item.content,
                    mission: item.mission,
                    moyen: item.moyen,
                    moyen_supp: item.moyen_supp,
                    details: item.details,
                    color: item.color,
                    kind: item.kind
                  });
                }}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/20 rounded text-blue-600 dark:text-blue-300 transition-colors"
                title="Modifier"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              </button>
            )}
            <button
              onClick={() => {
                setActiveColorPickerId(null);
                handleDelete(col.id, item.id);
              }}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/20 rounded text-red-500 dark:text-red-400 transition-colors"
              title="Supprimer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col gap-4">
      {/* Barre d'outils */}
      {!hideToolbar && (
        <div className="flex gap-3 p-2 bg-white/70 dark:bg-gray-900/50 rounded-lg border border-slate-200/80 dark:border-white/5 backdrop-blur-md shadow-sm dark:shadow-none">
          <button className="px-4 py-2 bg-red-500/80 hover:bg-red-500 text-white text-xs font-bold rounded transition-colors">Réinitialiser</button>
          <button className="px-4 py-2 bg-cyan-500/80 hover:bg-cyan-500 text-white text-xs font-bold rounded transition-colors">Exporter en image</button>
          <button className="px-4 py-2 bg-blue-600/80 hover:bg-blue-600 text-white text-xs font-bold rounded transition-colors">Générer avec IA</button>
          <div className="flex-1"></div>
          <button className="px-4 py-2 bg-green-600/80 hover:bg-green-600 text-white text-xs font-bold rounded transition-colors">Enregistrer</button>
        </div>
      )}

      {/* Kanban Board */}
      <div className={`flex-1 grid ${useExtendedLayout ? 'grid-cols-7' : 'grid-cols-5'} gap-4 min-h-[600px]`} ref={boardRef}>
        {Object.values(columns).map(col => {
          const headerColor = {
            blue: 'text-blue-700 border-blue-200/80 bg-blue-50/80 dark:text-blue-400 dark:border-blue-500/30 dark:bg-blue-900/20',
            green: 'text-green-700 border-green-200/80 bg-green-50/80 dark:text-green-400 dark:border-green-500/30 dark:bg-green-900/20',
            yellow: 'text-yellow-700 border-yellow-200/80 bg-yellow-50/80 dark:text-yellow-400 dark:border-yellow-500/30 dark:bg-yellow-900/20',
            red: 'text-red-700 border-red-200/80 bg-red-50/80 dark:text-red-400 dark:border-red-500/30 dark:bg-red-900/20',
            purple: 'text-purple-700 border-purple-200/80 bg-purple-50/80 dark:text-purple-400 dark:border-purple-500/30 dark:bg-purple-900/20',
            slate: 'text-slate-700 border-slate-200/80 bg-slate-50/80 dark:text-slate-300 dark:border-white/10 dark:bg-white/5',
            teal: 'text-teal-700 border-teal-200/80 bg-teal-50/80 dark:text-teal-400 dark:border-teal-500/30 dark:bg-teal-900/20',
            orange: 'text-orange-700 border-orange-200/80 bg-orange-50/80 dark:text-orange-400 dark:border-orange-500/30 dark:bg-orange-900/20'
          }[col.color];

          return (
            <div
              key={col.id}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.id)}
              className="flex flex-col h-full bg-white/80 dark:bg-gray-900/40 rounded-xl border border-slate-200/80 dark:border-white/5 overflow-hidden transition-colors hover:border-slate-300 dark:hover:border-white/10 shadow-sm dark:shadow-none"
            >
              <div className={`px-4 py-3 border-b flex items-center justify-between ${headerColor}`}>
                <div className="flex items-center gap-3 font-bold">
                  <span className="w-6 h-6 rounded bg-white/80 dark:bg-white/10 border border-slate-200/80 dark:border-white/10 flex items-center justify-center text-xs text-slate-700 dark:text-slate-100">{col.letter}</span>
                  {col.title}
                </div>
                <span className="text-xs text-slate-500 dark:text-white/60">{col.items.length}</span>
              </div>
              <div className="p-3 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2 min-h-0">
                {(() => {
                  if (col.id === 'O') {
                    let objectiveIndex = 0;
                    return col.items.map((item) => {
                      const shouldNumber = item.kind === 'objective';
                      const index = shouldNumber ? ++objectiveIndex : undefined;
                      const isActiveObjective = shouldNumber && (item.objectiveId ?? item.id) === activeObjectiveId;
                      return renderCard(item, col, { objectiveIndex: index, isActiveObjective });
                    });
                  }

                  if (col.id === 'I') {
                    const ideaCounters: Record<string, number> = {};
                    let unlinkedCounter = 0;
                    let hasShownUnlinked = false;
                    return col.items.map((item) => {
                      const isSpecial = item.kind === 'separator' || item.kind === 'empty';
                      let ideaNumberLabel: string | undefined;
                      let showUnlinkedHeader = false;
                      if (!isSpecial) {
                        const objectiveId = item.objectiveId ?? undefined;
                        const objectiveIndex = objectiveId ? objectiveIndexMap.get(objectiveId) : undefined;
                        if (objectiveId && objectiveIndex) {
                          ideaCounters[objectiveId] = (ideaCounters[objectiveId] ?? 0) + 1;
                          ideaNumberLabel = `${objectiveIndex}.${ideaCounters[objectiveId]}`;
                        } else {
                          unlinkedCounter += 1;
                          ideaNumberLabel = `NL.${unlinkedCounter}`;
                          if (!hasShownUnlinked) {
                            showUnlinkedHeader = true;
                            hasShownUnlinked = true;
                          }
                        }
                      }
                      return renderCard(item, col, { ideaNumberLabel, showUnlinkedHeader });
                    });
                  }

                  return col.items.map((item) => renderCard(item, col));
                })()}

                {/* Bouton Ajouter (toutes colonnes) */}
                {!readOnly && (
                  <button
                    onClick={() => setAddModal({ colId: col.id })}
                    className="w-full py-3 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:text-white/30 dark:hover:text-white/60 dark:hover:border-white/20 dark:hover:bg-white/5 transition-all group"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                )}

                {/* Bouton IA en bas de la colonne Situation */}
                {col.id === 'S' && !readOnly && (
                  <button
                    type="button"
                    onClick={handleGenerateAI}
                    disabled={isGeneratingAI}
                    data-export-hide="true"
                    className="w-full p-3 mt-auto rounded-lg border backdrop-blur-sm transition-all duration-200 bg-blue-50 border-blue-200 hover:bg-blue-100 hover:border-blue-300 text-blue-700 shadow-sm dark:bg-blue-900/25 dark:border-blue-500/40 dark:hover:bg-blue-800/40 dark:hover:border-blue-300/60 dark:text-blue-50 dark:shadow-inner flex items-center justify-center gap-2 font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isGeneratingAI ? (
                      <div className="w-5 h-5 border-2 border-blue-300 border-t-transparent dark:border-blue-200/50 rounded-full animate-spin" />
                    ) : (
                      <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-200" />
                    )}
                    <span>{aiGenerateLabel}</span>
                  </button>
                )}

                {/* Bouton IA en bas de la colonne Commandement */}
                {col.id === 'C' && !readOnly && (
                  <button
                    type="button"
                    data-export-hide="true"
                    className="w-full p-3 mt-auto rounded-lg border backdrop-blur-sm transition-all duration-200 bg-purple-50 border-purple-200 hover:bg-purple-100 hover:border-purple-300 text-purple-700 shadow-sm dark:bg-purple-900/25 dark:border-purple-500/40 dark:hover:bg-purple-800/40 dark:hover:border-purple-300/60 dark:text-purple-50 dark:shadow-inner flex items-center justify-center gap-2 font-semibold"
                  >
                    <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-200" />
                    <span>Générer un message de CR avec l&apos;IA</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal d'édition */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-gray-900 border border-white/10 rounded-xl p-6 w-full max-w-3xl max-h-[85vh] overflow-y-auto shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Modifier l'élément</h3>
            <div className="space-y-4">
              {editingItem.colId === 'E' ? (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs text-gray-400">Mission</label>
                      <button
                        type="button"
                        onClick={() => (isListening ? stopDictation() : startDictation('mission'))}
                        className={`w-9 h-9 rounded-full border flex items-center justify-center transition ${
                          isListening
                            ? 'bg-red-500/20 text-red-200 border-red-500/40'
                            : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
                        }`}
                        aria-label={isListening ? 'Arrêter la dictée' : 'Dicter la mission'}
                        title={isListening ? 'Arrêter la dictée' : 'Dicter la mission'}
                      >
                        {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                      </button>
                    </div>
                    <input
                      value={editingItem.mission || ''}
                      onChange={e => {
                        const next = stripAutoPlaceholder(editingItem.mission, e.target.value);
                        setEditingItem({ ...editingItem, mission: next });
                      }}
                      onFocus={() => clearAutoPlaceholder('mission')}
                      className="w-full bg-black/30 border border-white/10 rounded p-2 text-white text-sm focus:border-blue-500 outline-none"
                    />
                    {suggestions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {suggestions.map((s, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setEditingItem(prev => prev ? { ...prev, mission: s } : prev)}
                            className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded text-xs text-gray-200 border border-white/10 transition-colors"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                    {ideaQuickPicks.length > 0 && (
                      <div className="mt-3">
                        <div className="text-[11px] uppercase tracking-[0.2em] text-gray-500 mb-2">
                          Idées de manœuvre
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {ideaQuickPicks.map((idea) => (
                            <button
                              key={idea.id}
                              type="button"
                              onClick={() => setEditingItem((prev) => prev ? { ...prev, mission: `${idea.label} – ${idea.content}` } : prev)}
                              title={`${idea.label} – ${idea.content}`}
                              className="px-3 py-1 rounded-lg text-xs border border-white/10 bg-white/5 text-gray-200 hover:bg-white/10 transition-colors"
                            >
                              <span className="font-semibold mr-1">{idea.label}</span>
                              <span className="opacity-80">{idea.content}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Moyen</label>
                    <input
                      value={editingItem.moyen || ''}
                      onChange={e => {
                        const next = stripAutoPlaceholder(editingItem.moyen, e.target.value);
                        setEditingItem({ ...editingItem, moyen: next });
                      }}
                      onFocus={() => clearAutoPlaceholder('moyen')}
                      className="w-full bg-black/30 border border-white/10 rounded p-2 text-white text-sm focus:border-blue-500 outline-none"
                    />
                    {editingItem.colId === 'E' && moyenQuickPicks.length > 0 && (
                      <div className="mt-2">
                        <div className="text-[11px] uppercase tracking-[0.2em] text-gray-500 mb-2">
                          {hasSectorOptions ? 'Secteurs disponibles' : 'Engins disponibles'}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {moyenQuickPicks.map((option, idx) => {
                            const isEngine = option.type === 'engine';
                            const statusClass = isEngine
                              ? (option.status === 'demande'
                                ? 'border-dashed border-yellow-400 text-yellow-200'
                                : 'border-green-400 text-green-200')
                              : 'border-slate-500/40 text-slate-200';
                            return (
                              <button
                                key={`${option.label}-${idx}`}
                                type="button"
                                onClick={() => setEditingItem(prev => prev ? { ...prev, moyen: option.label } : prev)}
                                className={`px-3 py-1 rounded-lg text-xs border ${statusClass} bg-white/5 hover:bg-white/10`}
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : editingItem.colId === 'I' ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs text-gray-400">Idée de manœuvre</label>
                    <button
                      type="button"
                      onClick={() => (isListening ? stopDictation() : startDictation('content'))}
                      className={`w-9 h-9 rounded-full border flex items-center justify-center transition ${
                        isListening
                          ? 'bg-red-500/20 text-red-200 border-red-500/40'
                          : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
                      }`}
                      aria-label={isListening ? 'Arrêter la dictée' : 'Dicter une idée de manœuvre'}
                      title={isListening ? 'Arrêter la dictée' : 'Dicter une idée de manœuvre'}
                    >
                      {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                  </div>
                  <textarea
                    value={editingItem.content}
                    onChange={e => {
                      const next = stripAutoPlaceholder(editingItem.content, e.target.value);
                      setEditingItem({ ...editingItem, content: next });
                    }}
                    onFocus={() => clearAutoPlaceholder('content')}
                    rows={4}
                    className="w-full bg-black/30 border border-white/10 rounded p-2 text-white text-sm focus:border-blue-500 outline-none"
                  />
                  {suggestions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {suggestions.map((s, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setEditingItem(prev => prev ? { ...prev, content: s } : prev)}
                          className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded text-xs text-gray-200 border border-white/10 transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs text-gray-400">Contenu</label>
                    <button
                      type="button"
                      onClick={() => (isListening ? stopDictation() : startDictation('content'))}
                      className={`w-9 h-9 rounded-full border flex items-center justify-center transition ${
                        isListening
                          ? 'bg-red-500/20 text-red-200 border-red-500/40'
                          : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
                      }`}
                      aria-label={isListening ? 'Arrêter la dictée' : 'Dicter le contenu'}
                      title={isListening ? 'Arrêter la dictée' : 'Dicter le contenu'}
                    >
                      {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                  </div>
                  <textarea
                    value={editingItem.content}
                    onChange={e => {
                      const next = stripAutoPlaceholder(editingItem.content, e.target.value);
                      setEditingItem({ ...editingItem, content: next });
                    }}
                    onFocus={() => clearAutoPlaceholder('content')}
                    rows={5}
                    className="w-full bg-black/30 border border-white/10 rounded p-2 text-white text-sm focus:border-blue-500 outline-none"
                  />
                  {suggestions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {suggestions.map((s, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setEditingItem(prev => prev ? { ...prev, content: s } : prev)}
                          className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded text-xs text-gray-200 border border-white/10 transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {speechError && <div className="text-xs text-red-300">{speechError}</div>}
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setEditingItem(null)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Annuler</button>
                <button onClick={handleSaveEdit} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-bold">Enregistrer</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal d'ajout */}
      {addModal && !readOnly && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm"
          onClick={() => setAddModal(null)}
        >
          <div
            className="bg-gray-900 border border-white/10 rounded-xl p-6 w-full max-w-md shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white mb-2">Ajouter une carte</h3>
            <p className="text-xs text-gray-400 mb-4">
              Colonne : {columns[addModal.colId]?.title || addModal.colId}
            </p>
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => {
                  handleAddItem(addModal.colId, 'objective');
                  setAddModal(null);
                }}
                className="w-full px-4 py-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white text-sm font-semibold transition"
              >
                {getPrimaryAddLabel(addModal.colId)}
              </button>
              <button
                type="button"
                onClick={() => {
                  handleAddItem(addModal.colId, 'separator');
                  setAddModal(null);
                }}
                className="w-full px-4 py-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white text-sm font-semibold transition"
              >
                Ajouter un séparateur
              </button>
              <button
                type="button"
                onClick={() => {
                  handleAddItem(addModal.colId, 'empty');
                  setAddModal(null);
                }}
                className="w-full px-4 py-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white text-sm font-semibold transition"
              >
                Ajouter une carte vide
              </button>
            </div>
            <div className="flex justify-end mt-4">
              <button
                type="button"
                onClick={() => setAddModal(null)}
                className="px-4 py-2 text-gray-400 hover:text-white text-sm"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdreInitialView;
