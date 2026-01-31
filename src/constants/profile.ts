export const EMPLOYMENT_LEVEL_OPTIONS = [
  {
    value: 'chef_de_groupe',
    label: 'Chef de groupe',
    defaultShortcuts: ['functions', 'communication', 'operational_zoning']
  },
  {
    value: 'chef_de_colonne',
    label: 'Chef de colonne',
    defaultShortcuts: ['functions', 'sitac', 'operational_zoning', 'oct']
  },
  {
    value: 'chef_de_site',
    label: 'Chef de site',
    defaultShortcuts: ['functions', 'communication', 'sitac', 'oct']
  }
] as const;

export type EmploymentLevel = typeof EMPLOYMENT_LEVEL_OPTIONS[number]['value'];

export const SHORTCUT_OPTIONS = [
  {
    key: 'functions',
    label: 'Fonctions opérationnelles',
    path: '/functions'
  },
  {
    key: 'communication',
    label: 'Communication OPS',
    path: '/command-type/communication'
  },
  {
    key: 'operational_zoning',
    label: 'Zonage opérationnel',
    path: '/operational-zoning'
  },
  {
    key: 'sitac',
    label: 'SITAC',
    path: '/sitac'
  },
  {
    key: 'oct',
    label: 'Organigramme OCT',
    path: '/oct'
  }
] as const;

export type ShortcutKey = typeof SHORTCUT_OPTIONS[number]['key'];

export const normalizeEmploymentLevel = (value: string | null | undefined): EmploymentLevel | null => {
  if (!value) return null;
  const found = EMPLOYMENT_LEVEL_OPTIONS.find((option) => option.value === value);
  return found ? found.value : null;
};
