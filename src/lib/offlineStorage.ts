import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface StoreDB extends DBSchema {
  products: {
    key: string;
    value: any;
    indexes: { 'by-updated': Date };
  };
  sales: {
    key: string;
    value: any;
    indexes: { 'by-created': Date };
  };
  expenses: {
    key: string;
    value: any;
    indexes: { 'by-created': Date };
  };
  attendance: {
    key: string;
    value: any;
    indexes: { 'by-clock-in': Date };
  };
  sync_queue: {
    key: number;
    value: {
      id?: number;
      table: string;
      operation: 'insert' | 'update' | 'delete';
      data: any;
      timestamp: Date;
    };
  };
}

let db: IDBPDatabase<StoreDB> | null = null;

export const initDB = async () => {
  if (db) return db;
  
  db = await openDB<StoreDB>('store-manager-db', 1, {
    upgrade(db) {
      // Products store
      if (!db.objectStoreNames.contains('products')) {
        const productStore = db.createObjectStore('products', { keyPath: 'id' });
        productStore.createIndex('by-updated', 'updated_at');
      }
      
      // Sales store
      if (!db.objectStoreNames.contains('sales')) {
        const salesStore = db.createObjectStore('sales', { keyPath: 'id' });
        salesStore.createIndex('by-created', 'created_at');
      }
      
      // Expenses store
      if (!db.objectStoreNames.contains('expenses')) {
        const expenseStore = db.createObjectStore('expenses', { keyPath: 'id' });
        expenseStore.createIndex('by-created', 'created_at');
      }
      
      // Attendance store
      if (!db.objectStoreNames.contains('attendance')) {
        const attendanceStore = db.createObjectStore('attendance', { keyPath: 'id' });
        attendanceStore.createIndex('by-clock-in', 'clock_in');
      }
      
      // Sync queue store
      if (!db.objectStoreNames.contains('sync_queue')) {
        db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
      }
    },
  });
  
  return db;
};

// Cache data locally
export const cacheData = async (table: keyof Omit<StoreDB, 'sync_queue'>, data: any[]) => {
  const database = await initDB();
  const tx = database.transaction(table as any, 'readwrite');
  
  await Promise.all(data.map(item => tx.store.put(item)));
  await tx.done;
};

// Get cached data
export const getCachedData = async (table: keyof Omit<StoreDB, 'sync_queue'>) => {
  const database = await initDB();
  return await database.getAll(table as any);
};

// Add to sync queue
export const addToSyncQueue = async (
  table: string,
  operation: 'insert' | 'update' | 'delete',
  data: any
) => {
  const database = await initDB();
  await database.add('sync_queue', {
    table,
    operation,
    data,
    timestamp: new Date(),
  });
};

// Get sync queue
export const getSyncQueue = async () => {
  const database = await initDB();
  return await database.getAll('sync_queue');
};

// Clear sync queue item
export const clearSyncQueueItem = async (id: number) => {
  const database = await initDB();
  await database.delete('sync_queue', id);
};

// Clear all sync queue
export const clearSyncQueue = async () => {
  const database = await initDB();
  await database.clear('sync_queue');
};
