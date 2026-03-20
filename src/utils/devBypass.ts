import type { User } from '@supabase/supabase-js';
import type { ProfileRow } from '../contexts/ProfileContext';

export const isDevAuthBypassEnabled = () => (
  import.meta.env.DEV && import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'
);

export const buildDevBypassUser = (): User => ({
  id: 'dev-bypass-user',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
  email: 'dev@atlas.local'
} as User);

export const buildDevBypassProfile = (): ProfileRow => {
  const now = new Date().toISOString();
  return {
    id: 'dev-bypass-user',
    first_name: 'Mode',
    last_name: 'Dev',
    employment_level: 'chef_de_groupe',
    shortcut_keys: ['functions', 'communication', 'operational_zoning'],
    created_at: now,
    updated_at: now
  };
};
