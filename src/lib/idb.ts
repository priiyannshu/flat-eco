import { TiffinRecord, RentRecord, ElectricityBill, AppNotification, UserProfile, OfflineMutation } from '../types';

const DB_NAME = 'flat_eco_idb';
const DB_VERSION = 2;

export class LocalDB {
  private db: IDBDatabase | null = null;

  async open(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const tx = (event.target as IDBOpenDBRequest).transaction;

        if (!db.objectStoreNames.contains('tiffins')) {
          const store = db.createObjectStore('tiffins', { keyPath: 'id' });
          store.createIndex('date', 'date', { unique: false });
        }
        if (!db.objectStoreNames.contains('rent')) {
          const store = db.createObjectStore('rent', { keyPath: 'id' });
          store.createIndex('user_month', ['user_id', 'month'], { unique: false });
        }
        if (!db.objectStoreNames.contains('bills')) {
          const store = db.createObjectStore('bills', { keyPath: 'id' });
          store.createIndex('billing_month', 'billing_month', { unique: false });
        }
        if (db.objectStoreNames.contains('receipts')) {
          db.deleteObjectStore('receipts');
        }
        if (!db.objectStoreNames.contains('notifications')) {
          const store = db.createObjectStore('notifications', { keyPath: 'id' });
          store.createIndex('target_user_id', 'target_user_id', { unique: false });
        }
        if (!db.objectStoreNames.contains('users')) {
          db.createObjectStore('users', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('mutations')) {
          const store = db.createObjectStore('mutations', { keyPath: 'id' });
          store.createIndex('status', 'status', { unique: false });
        }

        // Empty existing fake data stores on upgrade to v2
        if (event.oldVersion < 2 && tx) {
          const storesToClear = ['tiffins', 'rent', 'bills', 'notifications', 'mutations'];
          for (const s of storesToClear) {
            if (db.objectStoreNames.contains(s)) {
              try {
                tx.objectStore(s).clear();
              } catch {}
            }
          }
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  // Generic helpers
  async getAll<T>(storeName: string): Promise<T[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async get<T>(storeName: string, key: string): Promise<T | undefined> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async put<T>(storeName: string, item: T): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async putMany<T>(storeName: string, items: T[]): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      for (const item of items) {
        store.put(item);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async delete(storeName: string, key: string): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async clearStore(storeName: string): Promise<void> {
    const db = await this.open();
    if (!db.objectStoreNames.contains(storeName)) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async clearAllData(): Promise<void> {
    const stores = ['tiffins', 'rent', 'bills', 'notifications', 'mutations'];
    for (const s of stores) {
      await this.clearStore(s);
    }
  }

  // Mutation Queue for Offline Sync
  async addMutation(action: OfflineMutation['action'], payload: any): Promise<string> {
    const id = 'mut_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const mutation: OfflineMutation = {
      id,
      action,
      payload,
      created_at: Date.now(),
      status: 'pending',
      retries: 0
    };
    await this.put('mutations', mutation);
    return id;
  }

  async getPendingMutations(): Promise<OfflineMutation[]> {
    const all = await this.getAll<OfflineMutation>('mutations');
    return all.filter(m => m.status === 'pending' || m.status === 'failed');
  }

  async removeMutation(id: string): Promise<void> {
    await this.delete('mutations', id);
  }
}

export const localDB = new LocalDB();
