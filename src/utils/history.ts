import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export interface HistoryEntry {
  id: string;
  type: 'group' | 'column';
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
  return newEntry;
};

export const getHistory = (): HistoryEntry[] => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
};

export const clearHistory = () => {
  localStorage.removeItem(STORAGE_KEY);
};