import type { User } from '@supabase/supabase-js';
import type { ProfileRow } from '../contexts/ProfileContext';

const DEV_AUTH_BYPASS_STORAGE_KEY = 'atlas-dev-auth-bypass';

const canUseDevBypass = () => import.meta.env.DEV;

const readStoredDevBypass = () => {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(DEV_AUTH_BYPASS_STORAGE_KEY) === 'true';
};

export const isDevAuthBypassAvailable = () => canUseDevBypass();

export const isDevAuthBypassEnabled = () => {
  if (!canUseDevBypass()) return false;
  return import.meta.env.VITE_DEV_AUTH_BYPASS === 'true' || readStoredDevBypass();
};

export const setDevAuthBypassEnabled = (enabled: boolean) => {
  if (!canUseDevBypass() || typeof window === 'undefined') return;
  if (enabled) {
    window.localStorage.setItem(DEV_AUTH_BYPASS_STORAGE_KEY, 'true');
    return;
  }
  window.localStorage.removeItem(DEV_AUTH_BYPASS_STORAGE_KEY);
};

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
