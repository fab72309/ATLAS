import type { SupabaseClient } from '@supabase/supabase-js';

type OutboxPayloadByTable = {
  intervention_draft_snapshots: {
    id: string;
    intervention_id: string;
    user_id: string;
    recorded_at: string;
    draft: Record<string, unknown>;
    source: string;
  };
  ml_isa_ratings: {
    id: string;
    intervention_id: string;
    user_id: string;
    recorded_at: string;
    isa: number;
    source: string;
  };
};

export type OutboxTable = keyof OutboxPayloadByTable;
export type OutboxPayload<T extends OutboxTable = OutboxTable> = OutboxPayloadByTable[T];

type OutboxItem<T extends OutboxTable = OutboxTable> = {
  id: string;
  table: T;
  payload: OutboxPayloadByTable[T];
  createdAt: string;
  attemptCount: number;
  nextAttemptAt: string | null;
  status: 'pending' | 'failed';
  lastError: string | null;
};

const DB_NAME = 'atlas-outbox';
const STORE_NAME = 'outbox';
const DB_VERSION = 1;
const IDEMPOTENT_TABLES = new Set<OutboxTable>(['intervention_draft_snapshots', 'ml_isa_ratings']);
const MAX_ATTEMPTS = 5;
const BASE_RETRY_DELAY_MS = 5_000;
const MAX_RETRY_DELAY_MS = 120_000;

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

const computeNextAttemptAt = (attemptCount: number) => {
  const delayMs = Math.min(BASE_RETRY_DELAY_MS * (2 ** Math.max(0, attemptCount - 1)), MAX_RETRY_DELAY_MS);
  return new Date(Date.now() + delayMs).toISOString();
};

const isReadyToFlush = (item: OutboxItem) => (
  item.status !== 'failed' &&
  (!item.nextAttemptAt || new Date(item.nextAttemptAt).getTime() <= Date.now())
);

const resetFailedItems = async () =>
  withStore('readwrite', async (store) => {
    const items = await requestToPromise(store.getAll() as IDBRequest<OutboxItem[]>);
    await Promise.all(items.map(async (item) => {
      if (item.status !== 'failed') return;
      await requestToPromise(store.put({
        ...item,
        status: 'pending',
        nextAttemptAt: null,
        lastError: null
      }));
    }));
  });

export const enqueue = async <T extends OutboxTable>(table: T, payload: OutboxPayload<T>) => {
  try {
    const randomId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const item: OutboxItem<T> = {
      id: String(payload.id ?? randomId),
      table,
      payload,
      createdAt: new Date().toISOString(),
      attemptCount: 0,
      nextAttemptAt: null,
      status: 'pending',
      lastError: null
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
    const sorted = [...items]
      .filter(isReadyToFlush)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const item of sorted) {
      try {
        await sendItem(supabase, item);
        await deleteItem(item.id);
      } catch (error) {
        const attemptCount = item.attemptCount + 1;
        const failed = attemptCount >= MAX_ATTEMPTS;
        await putItem({
          ...item,
          attemptCount,
          nextAttemptAt: failed ? null : computeNextAttemptAt(attemptCount),
          status: failed ? 'failed' : 'pending',
          lastError: error instanceof Error ? error.message : 'Unknown outbox error'
        });
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
  void resetFailedItems().finally(attemptFlush);
};
