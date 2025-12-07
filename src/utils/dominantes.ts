import { } from 'react';

export type DominanteType =
  | 'Incendie'
  | 'Explosion'
  | 'Risque Gaz'
  | 'SUAP'
  | 'Accident de circulation'
  | 'SMV'
  | 'NRBC'
  | 'Pollution'
  | 'Risque Chimique'
  | 'Risque Radiologique'
  | 'Animaux'
  | 'Inondation'
  | 'Risque Bâtimentaire';

export const DEFAULT_DOMINANTES: DominanteType[] = [
  'Incendie',
  'Explosion',
  'Risque Gaz',
  'SUAP',
  'Accident de circulation',
  'SMV',
  'NRBC',
  'Pollution',
  'Risque Chimique',
  'Risque Radiologique',
  'Animaux',
  'Inondation',
  'Risque Bâtimentaire',
];

const STORAGE_KEY = 'atlas-dominantes-order';

const isDominante = (v: any): v is DominanteType =>
  (DEFAULT_DOMINANTES as readonly string[]).includes(String(v));

export const sanitizeOrder = (order: any): DominanteType[] => {
  const arr = Array.isArray(order) ? order : [];
  const filtered = arr.filter(isDominante) as DominanteType[];
  const unique: DominanteType[] = [];
  for (const v of filtered) {
    if (!unique.includes(v)) unique.push(v);
  }
  // Append any missing items in default order
  for (const v of DEFAULT_DOMINANTES) {
    if (!unique.includes(v)) unique.push(v);
  }
  return unique;
};

export const getDominantesOrder = (): DominanteType[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_DOMINANTES];
    const parsed = JSON.parse(raw);
    return sanitizeOrder(parsed);
  } catch {
    return [...DEFAULT_DOMINANTES];
  }
};

export const setDominantesOrder = (order: DominanteType[]) => {
  const cleaned = sanitizeOrder(order);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
  try {
    window.dispatchEvent(new CustomEvent('atlas:dominantes-order-changed'));
  } catch {}
  return cleaned;
};

