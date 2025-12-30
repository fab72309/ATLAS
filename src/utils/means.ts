import type { MeanItem } from '../types/means';

export const generateMeanId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `mean-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const normalizeMeanItems = (items: unknown[] | undefined): MeanItem[] => {
  if (!Array.isArray(items)) return [];
  return items.map((entry) => {
    const record = (entry ?? {}) as Record<string, unknown>;
    return {
      id: typeof record.id === 'string' ? record.id : generateMeanId(),
      name: typeof record.name === 'string' ? record.name : 'Moyen',
      status: record.status === 'demande' ? 'demande' : 'sur_place',
      category: typeof record.category === 'string' ? record.category : undefined
    };
  });
};
