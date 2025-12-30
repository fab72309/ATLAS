import { readUserScopedJSON, writeUserScopedJSON } from './userStorage';

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

const isDominante = (v: unknown): v is DominanteType =>
  (DEFAULT_DOMINANTES as readonly string[]).includes(String(v));

export const sanitizeOrder = (order: unknown): DominanteType[] => {
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
    const parsed = readUserScopedJSON<DominanteType[]>(STORAGE_KEY, 'local');
    if (!parsed) return [...DEFAULT_DOMINANTES];
    return sanitizeOrder(parsed);
  } catch {
    return [...DEFAULT_DOMINANTES];
  }
};

export const setDominantesOrder = (order: DominanteType[]) => {
  const cleaned = sanitizeOrder(order);
  writeUserScopedJSON(STORAGE_KEY, cleaned, 'local');
  try {
    window.dispatchEvent(new CustomEvent('atlas:dominantes-order-changed'));
  } catch (err) {
    void err;
  }
  return cleaned;
};
