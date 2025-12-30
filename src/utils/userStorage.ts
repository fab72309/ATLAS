import { supabase } from './supabaseClient';

const STORAGE_PREFIX = 'atlas:v1';

let activeUserId: string | null = null;
const listeners = new Set<(nextUserId: string | null, prevUserId: string | null) => void>();

export const getCurrentUserId = async (): Promise<string | null> => {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Auth session read error', error);
    return null;
  }
  return data.session?.user?.id ?? null;
};

export const getActiveUserId = () => activeUserId;

export const setActiveUserId = (nextUserId: string | null) => {
  if (nextUserId === activeUserId) return;
  const prev = activeUserId;
  activeUserId = nextUserId;
  listeners.forEach((listener) => listener(nextUserId, prev));
};

export const onActiveUserChange = (
  listener: (nextUserId: string | null, prevUserId: string | null) => void
) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getStorage = (kind: 'local' | 'session'): Storage | null => {
  if (typeof window === 'undefined') return null;
  return kind === 'local' ? window.localStorage : window.sessionStorage;
};

export const buildUserScopedKey = (baseKey: string, userId?: string | null): string | null => {
  const resolvedUserId = userId ?? activeUserId;
  if (!resolvedUserId) return null;
  return `${STORAGE_PREFIX}:${resolvedUserId}:${baseKey}`;
};

export const readUserScopedItem = (
  baseKey: string,
  kind: 'local' | 'session' = 'local',
  userId?: string | null
): string | null => {
  const storage = getStorage(kind);
  const key = buildUserScopedKey(baseKey, userId);
  if (!storage || !key) return null;
  return storage.getItem(key);
};

export const writeUserScopedItem = (
  baseKey: string,
  value: string,
  kind: 'local' | 'session' = 'local',
  userId?: string | null
) => {
  const storage = getStorage(kind);
  const key = buildUserScopedKey(baseKey, userId);
  if (!storage || !key) return;
  storage.setItem(key, value);
};

export const removeUserScopedItem = (
  baseKey: string,
  kind: 'local' | 'session' = 'local',
  userId?: string | null
) => {
  const storage = getStorage(kind);
  const key = buildUserScopedKey(baseKey, userId);
  if (!storage || !key) return;
  storage.removeItem(key);
};

export const readUserScopedJSON = <T>(
  baseKey: string,
  kind: 'local' | 'session' = 'local',
  userId?: string | null
): T | null => {
  const raw = readUserScopedItem(baseKey, kind, userId);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error('Storage JSON parse error', error);
    return null;
  }
};

export const writeUserScopedJSON = (
  baseKey: string,
  value: unknown,
  kind: 'local' | 'session' = 'local',
  userId?: string | null
) => {
  try {
    writeUserScopedItem(baseKey, JSON.stringify(value), kind, userId);
  } catch (error) {
    console.error('Storage JSON write error', error);
  }
};

export const clearUserScopedStorage = (userId: string | null) => {
  if (typeof window === 'undefined' || !userId) return;
  const prefix = `${STORAGE_PREFIX}:${userId}:`;
  const wipe = (storage: Storage) => {
    for (let i = storage.length - 1; i >= 0; i -= 1) {
      const key = storage.key(i);
      if (key && key.startsWith(prefix)) {
        storage.removeItem(key);
      }
    }
  };
  wipe(window.localStorage);
  wipe(window.sessionStorage);
};
