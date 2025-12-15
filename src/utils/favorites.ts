export type FavoriteKey =
  | 'functions'
  | 'communication'
  | 'zoning'
  | 'group'
  | 'column'
  | 'site'
  | 'sitac'
  | 'oct';

const STORAGE_KEY = 'atlas-favorites';

export const getFavorites = (): FavoriteKey[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || '[]';
    const parsed = JSON.parse(raw);
    const allowed = NAV_ITEMS.map((n) => n.key);
    return Array.isArray(parsed)
      ? (parsed as FavoriteKey[]).filter((k) => allowed.includes(k as FavoriteKey))
      : [];
  } catch {
    return [];
  }
};

export const setFavorites = (keys: FavoriteKey[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
};

export const toggleFavorite = (key: FavoriteKey): FavoriteKey[] => {
  const current = getFavorites();
  const exists = current.includes(key);
  const next = exists ? current.filter((k) => k !== key) : [...current, key];
  setFavorites(next);
  return next;
};

export interface NavItem {
  key: FavoriteKey;
  label: string;
  path: string;
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'functions', label: 'Fonctions opérationnelles', path: '/functions' },
  { key: 'communication', label: 'Communication OPS', path: '/command-type/communication' },
  { key: 'zoning', label: 'Zonage opérationnel', path: '/operational-zoning' },
  { key: 'group', label: 'Chef de groupe', path: '/command-type/group' },
  { key: 'column', label: 'Chef de colonne', path: '/command-type/column' },
  { key: 'site', label: 'Chef de site', path: '/command-type/site' },
  { key: 'sitac', label: 'SITAC MapLibre', path: '/sitac' },
  { key: 'oct', label: 'OCT – Organigramme transmissions', path: '/oct' },
];
