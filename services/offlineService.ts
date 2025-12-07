// ============================================================
// OFFLINE SERVICE - IndexedDB + Sync Queue
// ============================================================
// Provides offline-first data storage and background sync
// ============================================================

const DB_NAME = 'sha2etna_offline';
const DB_VERSION = 1;

interface SyncQueueItem {
  id: string;
  action: 'create' | 'update' | 'delete';
  table: string;
  data: Record<string, unknown>;
  timestamp: number;
  retries: number;
}

let db: IDBDatabase | null = null;

// ============================================================
// DATABASE INITIALIZATION
// ============================================================
export const initOfflineDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Cached data stores
      if (!database.objectStoreNames.contains('expenses')) {
        database.createObjectStore('expenses', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('payments')) {
        database.createObjectStore('payments', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('shopping_items')) {
        database.createObjectStore('shopping_items', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('chat_messages')) {
        database.createObjectStore('chat_messages', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('bills')) {
        database.createObjectStore('bills', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('notifications')) {
        database.createObjectStore('notifications', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('group')) {
        database.createObjectStore('group', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('users')) {
        database.createObjectStore('users', { keyPath: 'id' });
      }

      // Sync queue for offline actions
      if (!database.objectStoreNames.contains('sync_queue')) {
        const syncStore = database.createObjectStore('sync_queue', { keyPath: 'id' });
        syncStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Last sync timestamp
      if (!database.objectStoreNames.contains('meta')) {
        database.createObjectStore('meta', { keyPath: 'key' });
      }
    };
  });
};

// ============================================================
// GENERIC CRUD OPERATIONS
// ============================================================
export const saveToStore = async <T extends { id: string }>(
  storeName: string, 
  data: T | T[]
): Promise<void> => {
  const database = await initOfflineDB();
  const tx = database.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  
  const items = Array.isArray(data) ? data : [data];
  items.forEach(item => store.put(item));
  
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const getFromStore = async <T>(storeName: string): Promise<T[]> => {
  const database = await initOfflineDB();
  const tx = database.transaction(storeName, 'readonly');
  const store = tx.objectStore(storeName);
  const request = store.getAll();
  
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
};

export const getByIdFromStore = async <T>(
  storeName: string, 
  id: string
): Promise<T | null> => {
  const database = await initOfflineDB();
  const tx = database.transaction(storeName, 'readonly');
  const store = tx.objectStore(storeName);
  const request = store.get(id);
  
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as T || null);
    request.onerror = () => reject(request.error);
  });
};

export const deleteFromStore = async (storeName: string, id: string): Promise<void> => {
  const database = await initOfflineDB();
  const tx = database.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  store.delete(id);
  
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const clearStore = async (storeName: string): Promise<void> => {
  const database = await initOfflineDB();
  const tx = database.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  store.clear();
  
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

// ============================================================
// SYNC QUEUE OPERATIONS
// ============================================================
export const addToSyncQueue = async (
  action: SyncQueueItem['action'],
  table: string,
  data: Record<string, unknown>
): Promise<void> => {
  const item: SyncQueueItem = {
    id: `sync_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    action,
    table,
    data,
    timestamp: Date.now(),
    retries: 0
  };
  
  await saveToStore('sync_queue', item);
};

export const getSyncQueue = async (): Promise<SyncQueueItem[]> => {
  return getFromStore<SyncQueueItem>('sync_queue');
};

export const removeFromSyncQueue = async (id: string): Promise<void> => {
  await deleteFromStore('sync_queue', id);
};

export const updateSyncQueueItem = async (item: SyncQueueItem): Promise<void> => {
  await saveToStore('sync_queue', item);
};

// ============================================================
// META OPERATIONS (Last Sync, etc.)
// ============================================================
interface MetaItem {
  id: string;
  value: unknown;
  updatedAt: number;
}

export const setMeta = async (key: string, value: unknown): Promise<void> => {
  const metaItem: MetaItem = { id: key, value, updatedAt: Date.now() };
  await saveToStore('meta', metaItem);
};

export const getMeta = async <T>(key: string): Promise<T | null> => {
  const result = await getByIdFromStore<MetaItem>('meta', key);
  return (result?.value as T) ?? null;
};

// ============================================================
// CACHE HELPERS
// ============================================================
export const cacheExpenses = async (expenses: unknown[]): Promise<void> => {
  await clearStore('expenses');
  if (expenses.length > 0) {
    await saveToStore('expenses', expenses as { id: string }[]);
  }
  await setMeta('lastExpensesSync', Date.now());
};

export const getCachedExpenses = async (): Promise<unknown[]> => {
  return getFromStore('expenses');
};

export const cachePayments = async (payments: unknown[]): Promise<void> => {
  await clearStore('payments');
  if (payments.length > 0) {
    await saveToStore('payments', payments as { id: string }[]);
  }
  await setMeta('lastPaymentsSync', Date.now());
};

export const getCachedPayments = async (): Promise<unknown[]> => {
  return getFromStore('payments');
};

export const cacheShoppingItems = async (items: unknown[]): Promise<void> => {
  await clearStore('shopping_items');
  if (items.length > 0) {
    await saveToStore('shopping_items', items as { id: string }[]);
  }
  await setMeta('lastShoppingSync', Date.now());
};

export const getCachedShoppingItems = async (): Promise<unknown[]> => {
  return getFromStore('shopping_items');
};

export const cacheChatMessages = async (messages: unknown[]): Promise<void> => {
  // Don't clear - append new messages
  if (messages.length > 0) {
    await saveToStore('chat_messages', messages as { id: string }[]);
  }
  await setMeta('lastChatSync', Date.now());
};

export const getCachedChatMessages = async (): Promise<unknown[]> => {
  return getFromStore('chat_messages');
};

export const cacheBills = async (bills: unknown[]): Promise<void> => {
  await clearStore('bills');
  if (bills.length > 0) {
    await saveToStore('bills', bills as { id: string }[]);
  }
  await setMeta('lastBillsSync', Date.now());
};

export const getCachedBills = async (): Promise<unknown[]> => {
  return getFromStore('bills');
};

export const cacheGroup = async (group: unknown): Promise<void> => {
  await saveToStore('group', group as { id: string });
  await setMeta('lastGroupSync', Date.now());
};

export const getCachedGroup = async (): Promise<unknown | null> => {
  const groups = await getFromStore('group');
  return groups[0] || null;
};

export const cacheUsers = async (users: unknown[]): Promise<void> => {
  await clearStore('users');
  if (users.length > 0) {
    await saveToStore('users', users as { id: string }[]);
  }
  await setMeta('lastUsersSync', Date.now());
};

export const getCachedUsers = async (): Promise<unknown[]> => {
  return getFromStore('users');
};

// ============================================================
// NETWORK STATUS
// ============================================================
export const isOnline = (): boolean => {
  return navigator.onLine;
};

// ============================================================
// SYNC PROCESSOR
// ============================================================
export const processSyncQueue = async (
  syncHandler: (item: SyncQueueItem) => Promise<boolean>
): Promise<{ success: number; failed: number }> => {
  if (!isOnline()) {
    return { success: 0, failed: 0 };
  }

  const queue = await getSyncQueue();
  let success = 0;
  let failed = 0;

  for (const item of queue.sort((a, b) => a.timestamp - b.timestamp)) {
    try {
      const result = await syncHandler(item);
      if (result) {
        await removeFromSyncQueue(item.id);
        success++;
      } else {
        item.retries++;
        if (item.retries >= 3) {
          await removeFromSyncQueue(item.id);
          failed++;
        } else {
          await updateSyncQueueItem(item);
        }
      }
    } catch {
      item.retries++;
      if (item.retries >= 3) {
        await removeFromSyncQueue(item.id);
        failed++;
      } else {
        await updateSyncQueueItem(item);
      }
    }
  }

  return { success, failed };
};

// ============================================================
// INITIALIZE ON IMPORT
// ============================================================
if (typeof window !== 'undefined') {
  initOfflineDB().catch(console.error);
}
