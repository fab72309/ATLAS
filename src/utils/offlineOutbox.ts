import type { SupabaseClient } from '@supabase/supabase-js';

type OutboxItem = {
  id: string;
  table: string;
  payload: Record<string, unknown>;
  createdAt: string;
  attemptCount: number;
};

const DB_NAME = 'atlas-outbox';
const STORE_NAME = 'outbox';
const DB_VERSION = 1;
const IDEMPOTENT_TABLES = new Set(['intervention_draft_snapshots', 'ml_isa_ratings']);

let syncStarted = false;
let flushInFlight: Promise<void> | null = null;
let flushTimer: number | null = null;

const openDb = (): Promise<IDBDatabase> => {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB not available'));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const withStore = async <T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => Promise<T>) => {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, mode);
  const store = tx.objectStore(STORE_NAME);
  const result = await fn(store);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  db.close();
  return result;
};

const listItems = async (): Promise<OutboxItem[]> =>
  withStore('readonly', async (store) => requestToPromise(store.getAll() as IDBRequest<OutboxItem[]>));

const putItem = async (item: OutboxItem) =>
  withStore('readwrite', async (store) => {
    await requestToPromise(store.put(item));
  });

const deleteItem = async (id: string) =>
  withStore('readwrite', async (store) => {
    await requestToPromise(store.delete(id));
  });

export const enqueue = async (table: string, payload: Record<string, unknown>) => {
  try {
    const randomId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const item: OutboxItem = {
      id: String(payload.id ?? randomId),
      table,
      payload,
      createdAt: new Date().toISOString(),
      attemptCount: 0
    };
    await putItem(item);
  } catch (error) {
    console.warn('[outbox] Failed to enqueue item', error);
  }
};

const sendItem = async (supabase: SupabaseClient, item: OutboxItem) => {
  const payload = item.payload;
  if (IDEMPOTENT_TABLES.has(item.table) && payload.id) {
    const { error } = await supabase.from(item.table).upsert(payload, { onConflict: 'id' });
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from(item.table).insert(payload);
  if (error) throw error;
};

export const flush = async (supabase: SupabaseClient) => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  if (flushInFlight) return flushInFlight;
  flushInFlight = (async () => {
    const items = await listItems();
    if (!items.length) return;
    const sorted = [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const item of sorted) {
      try {
        await sendItem(supabase, item);
        await deleteItem(item.id);
      } catch (error) {
        await putItem({ ...item, attemptCount: item.attemptCount + 1 });
        console.warn('[outbox] Failed to flush item', error);
      }
    }
  })().finally(() => {
    flushInFlight = null;
  });
  return flushInFlight;
};

export const startOutboxSync = (supabase: SupabaseClient, intervalMs = 20_000) => {
  if (syncStarted) return;
  syncStarted = true;
  const attemptFlush = () => {
    void flush(supabase);
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('online', attemptFlush);
  }
  if (flushTimer !== null) window.clearInterval(flushTimer);
  flushTimer = window.setInterval(attemptFlush, intervalMs);
  attemptFlush();
};
