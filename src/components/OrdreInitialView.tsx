import React, { useState, useEffect } from 'react';
import { OrdreInitial } from '../types/soiec';

interface OrdreInitialViewProps {
  ordre: OrdreInitial | null;
  onChange?: (ordre: OrdreInitial) => void;
  hideToolbar?: boolean;
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

const safeRender = (content: any) => {
  if (typeof content === 'string') return content;
  if (typeof content === 'number') return content;
  if (Array.isArray(content)) return content.map(c => safeRender(c)).join('\n');
  if (!content) return '';
  return JSON.stringify(content);
};

// Générateur d'ID unique simple
const generateId = () => Math.random().toString(36).substr(2, 9);

const OrdreInitialView: React.FC<OrdreInitialViewProps> = ({ ordre, onChange, hideToolbar = false }) => {
  const [columns, setColumns] = useState<Record<string, ColumnData>>({});
  const [draggedItem, setDraggedItem] = useState<{ id: string, sourceCol: string } | null>(null);
  const [editingItem, setEditingItem] = useState<{ id: string, colId: string, content: string, mission?: string, moyen?: string } | null>(null);

  // Initialisation des données
  useEffect(() => {
    if (!ordre) {
      // Initialize with empty structure
      setColumns({
        S: { id: 'S', title: 'Situation', letter: 'S', color: 'blue', items: [] },
        O: { id: 'O', title: 'Objectif', letter: 'O', color: 'green', items: [] },
        I: { id: 'I', title: 'Idée de manœuvre', letter: 'I', color: 'yellow', items: [] },
        E: { id: 'E', title: 'Exécution', letter: 'E', color: 'red', items: [] },
        C: { id: 'C', title: 'Commandement', letter: 'C', color: 'purple', items: [] }
      });
      return;
    }

    const processItems = (content: any, isManeuver = false): CardItem[] => {
      if (!content) return [];
      if (Array.isArray(content)) {
        return content.map(item => ({
          id: generateId(),
          content: isManeuver ? '' : safeRender(item),
          mission: isManeuver ? item.mission : undefined,
          moyen: isManeuver ? item.moyen : undefined,
          moyen_supp: isManeuver ? item.moyen_supp : undefined,
          details: isManeuver ? item.details : undefined
        }));
      }
      // String unique splitée par ligne
      return typeof content === 'string'
        ? content.split('\n').filter(l => l.trim()).map(l => ({ id: generateId(), content: l }))
        : [{ id: generateId(), content: safeRender(content) }];
    };

    setColumns({
      S: { id: 'S', title: 'Situation', letter: 'S', color: 'blue', items: processItems(ordre.S) },
      O: { id: 'O', title: 'Objectif', letter: 'O', color: 'green', items: processItems(ordre.O) },
      I: { id: 'I', title: 'Idée de manœuvre', letter: 'I', color: 'yellow', items: processItems(ordre.I) },
      E: { id: 'E', title: 'Exécution', letter: 'E', color: 'red', items: processItems(ordre.E, true) },
      C: { id: 'C', title: 'Commandement', letter: 'C', color: 'purple', items: processItems(ordre.C) }
    });
  }, [ordre]);

  // Notify parent of changes
  useEffect(() => {
    if (!onChange) return;

    // Convert columns back to OrdreInitial format
    const ordreData: OrdreInitial = {
      S: columns.S?.items.map(i => i.content).join('\n') || '',
      O: columns.O?.items.map(i => i.content) || [],
      I: columns.I?.items.map(i => ({
        mission: i.content,
        moyen: 'Non spécifié',
        moyen_supp: '',
        details: ''
      })) || [],
      E: columns.E?.items.map(i => ({
        mission: i.mission || '',
        moyen: i.moyen || '',
        moyen_supp: i.moyen_supp || '',
        details: i.details || ''
      })) || [],
      C: columns.C?.items.map(i => i.content).join('\n') || ''
    };

    onChange(ordreData);
  }, [columns, onChange]);

  // Gestion du Drag & Drop
  const handleDragStart = (e: React.DragEvent, id: string, sourceCol: string) => {
    setDraggedItem({ id, sourceCol });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetColId: string, targetItemId?: string) => {
    e.preventDefault();
    if (!draggedItem) return;

    const sourceCol = columns[draggedItem.sourceCol];
    const targetCol = columns[targetColId];
    const itemToMove = sourceCol.items.find(i => i.id === draggedItem.id);

    if (!itemToMove) return;

    // Retirer de la source
    let newSourceItems = sourceCol.items.filter(i => i.id !== draggedItem.id);

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
    const newItem: CardItem = {
      id: generateId(),
      content: 'Nouvel élément',
      mission: colId === 'E' ? 'Nouvelle mission' : undefined,
      moyen: colId === 'E' ? 'Moyen' : undefined
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
      moyen: newItem.moyen
    });
  };

  // Gestion de l'édition
  const handleSaveEdit = () => {
    if (!editingItem) return;
    setColumns(prev => ({
      ...prev,
      [editingItem.colId]: {
        ...prev[editingItem.colId],
        items: prev[editingItem.colId].items.map(item =>
          item.id === editingItem.id
            ? { ...item, content: editingItem.content, mission: editingItem.mission, moyen: editingItem.moyen }
            : item
        )
      }
    }));
    setEditingItem(null);
  };

  const handleDelete = (colId: string, itemId: string) => {
    setColumns(prev => ({
      ...prev,
      [colId]: {
        ...prev[colId],
        items: prev[colId].items.filter(i => i.id !== itemId)
      }
    }));
  };

  // Rendu d'une carte
  const renderCard = (item: CardItem, col: ColumnData) => {
    const isExecution = col.id === 'E';
    const bgColor = {
      blue: 'bg-blue-900/20 border-blue-500/30 hover:bg-blue-900/30',
      green: 'bg-green-900/20 border-green-500/30 hover:bg-green-900/30',
      yellow: 'bg-yellow-900/20 border-yellow-500/30 hover:bg-yellow-900/30',
      red: 'bg-red-900/20 border-red-500/30 hover:bg-red-900/30',
      purple: 'bg-purple-900/20 border-purple-500/30 hover:bg-purple-900/30'
    }[col.color];

    return (
      <div
        key={item.id}
        draggable
        onDragStart={(e) => handleDragStart(e, item.id, col.id)}
        onDrop={(e) => {
          e.stopPropagation(); // Empêcher le drop sur la colonne
          handleDrop(e, col.id, item.id);
        }}
        className={`p-3 rounded-lg border backdrop-blur-sm cursor-move transition-all duration-200 group relative ${bgColor} mb-2`}
      >
        <div className="pr-8"> {/* Padding droit pour éviter le chevauchement avec les boutons */}
          {isExecution ? (
            <div className="space-y-1">
              <div className="font-bold text-red-100">{item.mission}</div>
              <div className="text-xs text-red-200/70">
                {item.moyen && <div>Moyen: {item.moyen}</div>}
                {item.moyen_supp && <div>Renfort: {item.moyen_supp}</div>}
              </div>
            </div>
          ) : (
            <div className="text-gray-100 text-sm whitespace-pre-wrap">{item.content}</div>
          )}
        </div>

        {/* Actions (Edit/Delete) - Plus gros et positionnés */}
        <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded p-1 backdrop-blur-md">
          <button
            onClick={() => setEditingItem({ id: item.id, colId: col.id, content: item.content, mission: item.mission, moyen: item.moyen })}
            className="p-1.5 hover:bg-white/20 rounded text-blue-300 transition-colors"
            title="Modifier"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          </button>
          <button
            onClick={() => handleDelete(col.id, item.id)}
            className="p-1.5 hover:bg-white/20 rounded text-red-400 transition-colors"
            title="Supprimer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col gap-4">
      {/* Barre d'outils */}
      {!hideToolbar && (
        <div className="flex gap-3 p-2 bg-gray-900/50 rounded-lg border border-white/5 backdrop-blur-md">
          <button className="px-4 py-2 bg-red-500/80 hover:bg-red-500 text-white text-xs font-bold rounded transition-colors">Réinitialiser</button>
          <button className="px-4 py-2 bg-cyan-500/80 hover:bg-cyan-500 text-white text-xs font-bold rounded transition-colors">Exporter en image</button>
          <button className="px-4 py-2 bg-blue-600/80 hover:bg-blue-600 text-white text-xs font-bold rounded transition-colors">Générer avec IA</button>
          <div className="flex-1"></div>
          <button className="px-4 py-2 bg-green-600/80 hover:bg-green-600 text-white text-xs font-bold rounded transition-colors">Enregistrer</button>
        </div>
      )}

      {/* Kanban Board */}
      <div className="flex-1 grid grid-cols-5 gap-4 min-h-[600px]">
        {Object.values(columns).map(col => {
          const headerColor = {
            blue: 'text-blue-400 border-blue-500/30 bg-blue-900/20',
            green: 'text-green-400 border-green-500/30 bg-green-900/20',
            yellow: 'text-yellow-400 border-yellow-500/30 bg-yellow-900/20',
            red: 'text-red-400 border-red-500/30 bg-red-900/20',
            purple: 'text-purple-400 border-purple-500/30 bg-purple-900/20'
          }[col.color];

          return (
            <div
              key={col.id}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.id)}
              className="flex flex-col h-full bg-gray-900/40 rounded-xl border border-white/5 overflow-hidden transition-colors hover:border-white/10"
            >
              <div className={`px-4 py-3 border-b flex items-center justify-between ${headerColor}`}>
                <div className="flex items-center gap-3 font-bold">
                  <span className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-xs">{col.letter}</span>
                  {col.title}
                </div>
                <span className="text-xs opacity-50">{col.items.length}</span>
              </div>
              <div className="p-3 flex-1 overflow-y-auto custom-scrollbar">
                {col.items.map(item => renderCard(item, col))}

                {/* Bouton Ajouter */}
                <button
                  onClick={() => handleAddItem(col.id)}
                  className="w-full py-3 border-2 border-dashed border-white/10 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:border-white/20 hover:bg-white/5 transition-all group"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal d'édition */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-gray-900 border border-white/10 rounded-xl p-6 w-full max-w-lg shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Modifier l'élément</h3>
            <div className="space-y-4">
              {editingItem.colId === 'I' ? (
                <>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Mission</label>
                    <input
                      value={editingItem.mission || ''}
                      onChange={e => setEditingItem({ ...editingItem, mission: e.target.value })}
                      className="w-full bg-black/30 border border-white/10 rounded p-2 text-white text-sm focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Moyen</label>
                    <input
                      value={editingItem.moyen || ''}
                      onChange={e => setEditingItem({ ...editingItem, moyen: e.target.value })}
                      className="w-full bg-black/30 border border-white/10 rounded p-2 text-white text-sm focus:border-blue-500 outline-none"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Contenu</label>
                  <textarea
                    value={editingItem.content}
                    onChange={e => setEditingItem({ ...editingItem, content: e.target.value })}
                    rows={5}
                    className="w-full bg-black/30 border border-white/10 rounded p-2 text-white text-sm focus:border-blue-500 outline-none"
                  />
                </div>
              )}
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
