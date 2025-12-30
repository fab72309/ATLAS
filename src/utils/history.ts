import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { readUserScopedJSON, writeUserScopedJSON, removeUserScopedItem } from './userStorage';

export interface HistoryEntry {
  id: string;
  type: 'group' | 'column' | 'site' | 'communication';
  situation: string;
  analysis: string;
  timestamp: string;
}

const STORAGE_KEY = 'emergency-history';

export const addToHistory = (entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => {
  const history = getHistory();
  const newEntry: HistoryEntry = {
    ...entry,
    id: Date.now().toString(),
    timestamp: format(new Date(), 'PPpp', { locale: fr }),
  };
  
  const updatedHistory = [newEntry, ...history].slice(0, 50); // Keep last 50 entries
  writeUserScopedJSON(STORAGE_KEY, updatedHistory, 'local');
  return newEntry;
};

export const getHistory = (): HistoryEntry[] => {
  try {
    const parsed = readUserScopedJSON<HistoryEntry[]>(STORAGE_KEY, 'local');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const clearHistory = () => {
  removeUserScopedItem(STORAGE_KEY, 'local');
};
