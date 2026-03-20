import { useEffect, useState } from 'react';
import { readUserScopedJSON, writeUserScopedJSON } from './userStorage';

export type OperationalTabId = 'moyens' | 'message' | 'soiec' | 'oct' | 'sitac' | 'aide';

export type AppSettings = {
  defaultOperationalTab: OperationalTabId;
  openaiProxyUrlOverride: string;
};

const STORAGE_KEY = 'atlas-app-settings';
const UPDATE_EVENT = 'atlas-app-settings:update';

const getDefaultSettings = (): AppSettings => ({
  defaultOperationalTab: 'moyens',
  openaiProxyUrlOverride: ''
});

const sanitizeUrlOverride = (value: unknown) => (
  typeof value === 'string' ? value.trim() : ''
);

const sanitizeOperationalTab = (value: unknown): OperationalTabId => {
  const allowed: OperationalTabId[] = ['moyens', 'message', 'soiec', 'oct', 'sitac', 'aide'];
  if (typeof value === 'string' && allowed.includes(value as OperationalTabId)) {
    return value as OperationalTabId;
  }
  return 'moyens';
};

export const readAppSettings = (): AppSettings => {
  try {
    const parsed = readUserScopedJSON<Partial<AppSettings>>(STORAGE_KEY, 'local');
    if (parsed) {
      return {
        defaultOperationalTab: sanitizeOperationalTab(parsed.defaultOperationalTab),
        openaiProxyUrlOverride: sanitizeUrlOverride(parsed.openaiProxyUrlOverride)
      };
    }
  } catch (err) {
    console.error('App settings read error', err);
  }
  return getDefaultSettings();
};

export const writeAppSettings = (settings: AppSettings) => {
  try {
    writeUserScopedJSON(STORAGE_KEY, settings, 'local');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(UPDATE_EVENT));
    }
  } catch (err) {
    console.error('App settings write error', err);
  }
};

export const updateAppSettings = (updater: (prev: AppSettings) => AppSettings) => {
  const next = updater(readAppSettings());
  writeAppSettings(next);
  return next;
};

export const useAppSettings = () => {
  const [settings, setSettings] = useState<AppSettings>(() => readAppSettings());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => setSettings(readAppSettings());
    window.addEventListener(UPDATE_EVENT, handler);
    return () => window.removeEventListener(UPDATE_EVENT, handler);
  }, []);

  const setAndStore = (next: AppSettings) => {
    writeAppSettings(next);
    setSettings(next);
  };

  const updateSettings = (updater: (prev: AppSettings) => AppSettings) => {
    const next = updateAppSettings(updater);
    setSettings(next);
  };

  return { settings, setSettings: setAndStore, updateSettings };
};
