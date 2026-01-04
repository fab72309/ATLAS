import React, { useState, useEffect, useRef, useMemo } from 'react';
import { OrdreInitial } from '../types/soiec';
import { SpeechRecognitionService } from '../utils/speechRecognition';
import { DominanteType } from './DominantSelector';
import { DOCTRINE_CONTEXT } from '../constants/doctrine';
import { Sparkles } from 'lucide-react';
import { analyzeEmergency } from '../utils/openai';
import { parseOrdreInitial } from '../utils/soiec';

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
}

// Types pour la gestion d'état locale
interface CardItem {
  id: string;
  content: string;
  // Pour les idées de manœuvre
  mission?: string;
  moyen?: string;
  moyen_supp?: string;
  details?: string;
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

const buildColumnsFromOrdre = (
  ordre: OrdreInitial | null,
  useExtendedLayout: boolean
): Record<string, ColumnData> => {
  const processItems = (content: unknown, isManeuver = false): CardItem[] => {
    if (!content) return [];
    if (Array.isArray(content)) {
      return content.map(item => {
        const isPlainObject = item && typeof item === 'object' && !Array.isArray(item);
        return {
          id: generateId(),
          content: isManeuver ? '' : safeRender(item),
          mission: isManeuver ? (isPlainObject ? item.mission : safeRender(item)) : undefined,
          moyen: isManeuver && isPlainObject ? item.moyen : undefined,
          moyen_supp: isManeuver && isPlainObject ? item.moyen_supp : undefined,
          details: isManeuver && isPlainObject ? item.details : undefined
        };
      });
    }
    return typeof content === 'string'
      ? content.split('\n').filter(l => l.trim()).map(l => ({ id: generateId(), content: l }))
      : [{ id: generateId(), content: safeRender(content) }];
  };

  if (!ordre) {
    return {
      S: { id: 'S', title: 'Situation', letter: 'S', color: 'blue', items: [] },
      ...(useExtendedLayout ? { A: { id: 'A', title: 'Anticipation', letter: 'A', color: 'teal', items: [] } } : {}),
      O: { id: 'O', title: 'Objectif', letter: 'O', color: 'green', items: [] },
      I: { id: 'I', title: 'Idée de manœuvre', letter: 'I', color: 'yellow', items: [] },
      E: { id: 'E', title: 'Exécution', letter: 'E', color: 'red', items: [] },
      C: { id: 'C', title: 'Commandement', letter: 'C', color: 'purple', items: [] },
      ...(useExtendedLayout ? { L: { id: 'L', title: 'Logistique', letter: 'L', color: 'orange', items: [] } } : {})
    };
  }

  return {
    S: { id: 'S', title: 'Situation', letter: 'S', color: 'blue', items: processItems(ordre.S) },
    ...(useExtendedLayout ? { A: { id: 'A', title: 'Anticipation', letter: 'A', color: 'teal', items: processItems(ordre.A) } } : {}),
    O: { id: 'O', title: 'Objectif', letter: 'O', color: 'green', items: processItems(ordre.O) },
    I: { id: 'I', title: 'Idée de manœuvre', letter: 'I', color: 'yellow', items: processItems(ordre.I, true) },
    E: { id: 'E', title: 'Exécution', letter: 'E', color: 'red', items: processItems(ordre.E, true) },
    C: { id: 'C', title: 'Commandement', letter: 'C', color: 'purple', items: processItems(ordre.C) },
    ...(useExtendedLayout ? { L: { id: 'L', title: 'Logistique', letter: 'L', color: 'orange', items: processItems(ordre.L) } } : {})
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
  aiGenerateLabel = "Générer ordre initial avec l'IA"
}) => {
  const [columns, setColumns] = useState<Record<string, ColumnData>>({});
  const [draggedItem, setDraggedItem] = useState<{ id: string, sourceCol: string } | null>(null);
  const [editingItem, setEditingItem] = useState<{ id: string, colId: string, content: string, mission?: string, moyen?: string, moyen_supp?: string, details?: string } | null>(null);
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

    // Convert columns back to OrdreInitial format
    const situationItems = columns.S?.items?.map(i => i.content) ?? [];
    const anticipationItems = columns.A?.items?.map(i => i.content) ?? [];
    const commandItems = columns.C?.items?.map(i => i.content) ?? [];
    const logistiqueItems = columns.L?.items?.map(i => i.content) ?? [];
    const ordreData: OrdreInitial = {
      S: situationItems.join('\n'),
      ...(useExtendedLayout ? { A: anticipationItems } : {}),
      O: columns.O?.items?.map(i => i.content) || [],
      I: columns.I?.items?.map(i => ({
        mission: i.mission || i.content || '',
        moyen: i.moyen || '',
        moyen_supp: i.moyen_supp || '',
        details: i.details || ''
      })) || [],
      E: columns.E?.items?.map(i => ({
        mission: i.mission || '',
        moyen: i.moyen || '',
        moyen_supp: i.moyen_supp || '',
        details: i.details || ''
      })) || [],
      C: commandItems.join('\n'),
      ...(useExtendedLayout ? { L: logistiqueItems } : {})
    };

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
  const handleAddItem = (colId: string) => {
    if (readOnly) return;
    const isManeuver = colId === 'E' || colId === 'I';
    const newItem: CardItem = {
      id: generateId(),
      content: isManeuver ? '' : 'Nouvel élément',
      mission: isManeuver ? 'Nouvelle mission' : undefined,
      moyen: isManeuver ? 'Moyen' : undefined,
      moyen_supp: isManeuver ? 'Renfort' : undefined
    };

    setColumns(prev => ({
      ...prev,
      [colId]: {
        ...prev[colId],
        items: [...prev[colId].items, newItem]
      }
    }));

    // Ouvrir directement l'édition
    setEditingItem({
      id: newItem.id,
      colId,
      content: newItem.content,
      mission: newItem.mission,
      moyen: newItem.moyen,
      moyen_supp: newItem.moyen_supp
    });
  };

  // Gestion de l'édition
  const handleSaveEdit = () => {
    if (readOnly) return;
    if (!editingItem) return;
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
                details: editingItem.details
              }
            : item
        )
      }
    }));
    setEditingItem(null);
  };

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
    setColumns(prev => ({
      ...prev,
      [colId]: {
        ...prev[colId],
        items: prev[colId].items.filter(i => i.id !== itemId)
      }
    }));
  };

  const handleGenerateAI = async () => {
    if (readOnly) return;
    const situationText = (columns.S?.items || []).map(i => i.content).join('\n').trim();
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
    const query =
      editingItem.colId === 'I' || editingItem.colId === 'E'
        ? editingItem.mission || ''
        : editingItem.content || '';
    return getSuggestions(editingItem.colId, query);
  }, [editingItem, getSuggestions]);

  // Rendu d'une carte
  const renderCard = (item: CardItem, col: ColumnData) => {
    const isManeuver = col.id === 'I' || col.id === 'E';
    const missionTextClass =
      col.id === 'E'
        ? 'text-red-700 dark:text-red-100'
        : 'text-yellow-700 dark:text-yellow-100';
    const detailTextClass =
      col.id === 'E'
        ? 'text-red-600/80 dark:text-red-200/70'
        : 'text-yellow-700/80 dark:text-yellow-200/70';
    const missionValue = item.mission || item.content;
    const bgColor = {
      blue: 'bg-blue-50/80 border-blue-200/70 hover:bg-blue-100/70 dark:bg-blue-900/20 dark:border-blue-500/30 dark:hover:bg-blue-900/30',
      green: 'bg-green-50/80 border-green-200/70 hover:bg-green-100/70 dark:bg-green-900/20 dark:border-green-500/30 dark:hover:bg-green-900/30',
      yellow: 'bg-yellow-50/80 border-yellow-200/70 hover:bg-yellow-100/70 dark:bg-yellow-900/20 dark:border-yellow-500/30 dark:hover:bg-yellow-900/30',
      red: 'bg-red-50/80 border-red-200/70 hover:bg-red-100/70 dark:bg-red-900/20 dark:border-red-500/30 dark:hover:bg-red-900/30',
      purple: 'bg-purple-50/80 border-purple-200/70 hover:bg-purple-100/70 dark:bg-purple-900/20 dark:border-purple-500/30 dark:hover:bg-purple-900/30',
      teal: 'bg-teal-50/80 border-teal-200/70 hover:bg-teal-100/70 dark:bg-teal-900/20 dark:border-teal-500/30 dark:hover:bg-teal-900/30',
      orange: 'bg-orange-50/80 border-orange-200/70 hover:bg-orange-100/70 dark:bg-orange-900/20 dark:border-orange-500/30 dark:hover:bg-orange-900/30'
    }[col.color];

    return (
      <div
        key={item.id}
        draggable={!readOnly}
        onDragStart={(e) => handleDragStart(e, item.id, col.id)}
        onDrop={(e) => {
          if (readOnly) return;
          e.stopPropagation(); // Empêcher le drop sur la colonne
          handleDrop(e, col.id, item.id);
        }}
        className={`p-3 rounded-lg border backdrop-blur-sm transition-all duration-200 group relative shadow-sm dark:shadow-none ${bgColor} mb-2 ${readOnly ? 'cursor-default' : 'cursor-move'}`}
      >
        <div className="pr-8"> {/* Padding droit pour éviter le chevauchement avec les boutons */}
          {isManeuver ? (
            <div className="space-y-1">
              <div className={`font-bold ${missionTextClass}`}>{missionValue}</div>
              <div className={`text-xs ${detailTextClass}`}>
                {item.moyen && <div>Moyen: {item.moyen}</div>}
                {item.moyen_supp && <div>Renfort: {item.moyen_supp}</div>}
              </div>
            </div>
          ) : (
            <div className="text-slate-700 dark:text-gray-100 text-sm whitespace-pre-wrap">{item.content}</div>
          )}
        </div>

        {/* Actions (Edit/Delete) - Plus gros et positionnés */}
        {!readOnly && (
          <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 border border-slate-200 rounded p-1 shadow-sm backdrop-blur-md dark:bg-black/40 dark:border-transparent dark:shadow-none">
            <button
              onClick={() => setEditingItem({
                id: item.id,
                colId: col.id,
                content: item.content,
                mission: item.mission,
                moyen: item.moyen,
                moyen_supp: item.moyen_supp,
                details: item.details
              })}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/20 rounded text-blue-600 dark:text-blue-300 transition-colors"
              title="Modifier"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            </button>
            <button
              onClick={() => handleDelete(col.id, item.id)}
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
                {col.items.map(item => renderCard(item, col))}

                {/* Bouton Ajouter (toutes colonnes) */}
                {!readOnly && (
                  <button
                    onClick={() => handleAddItem(col.id)}
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
              {editingItem.colId === 'I' || editingItem.colId === 'E' ? (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs text-gray-400">Mission</label>
                      <button
                        type="button"
                        onClick={() => (isListening ? stopDictation() : startDictation('mission'))}
                        className={`text-xs px-2 py-1 rounded ${isListening ? 'bg-red-500/20 text-red-200' : 'bg-white/5 text-gray-300 hover:bg-white/10'}`}
                      >
                        {isListening ? 'Arrêter la dictée' : 'Dicter'}
                      </button>
                    </div>
                    <input
                      value={editingItem.mission || ''}
                      onChange={e => setEditingItem({ ...editingItem, mission: e.target.value })}
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
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Moyen</label>
                    <input
                      value={editingItem.moyen || ''}
                      onChange={e => setEditingItem({ ...editingItem, moyen: e.target.value })}
                      className="w-full bg-black/30 border border-white/10 rounded p-2 text-white text-sm focus:border-blue-500 outline-none"
                    />
                    {editingItem.colId === 'E' && means.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {means.map((m, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setEditingItem(prev => prev ? { ...prev, moyen: m.name } : prev)}
                            className={`px-3 py-1 rounded-lg text-xs border ${m.status === 'demande' ? 'border-dashed border-yellow-400 text-yellow-200' : 'border-green-400 text-green-200'} bg-white/5 hover:bg-white/10`}
                          >
                            {m.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs text-gray-400">Contenu</label>
                    <button
                      type="button"
                      onClick={() => (isListening ? stopDictation() : startDictation('content'))}
                      className={`text-xs px-2 py-1 rounded ${isListening ? 'bg-red-500/20 text-red-200' : 'bg-white/5 text-gray-300 hover:bg-white/10'}`}
                    >
                      {isListening ? 'Arrêter la dictée' : 'Dicter'}
                    </button>
                  </div>
                  <textarea
                    value={editingItem.content}
                    onChange={e => setEditingItem({ ...editingItem, content: e.target.value })}
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
    </div>
  );
};

export default OrdreInitialView;
