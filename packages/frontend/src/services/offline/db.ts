/**
 * IndexedDB schema and management for offline data
 * Provides enhanced offline capabilities with conflict resolution
 */

export interface OfflineActivity {
  id: string;
  data: any;
  timestamp: number;
  status: 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict';
  syncAttempts: number;
  lastSyncAttempt?: number;
  conflictData?: any;
  checksum?: string;
}

export interface OfflineTeam {
  id: string;
  name: string;
  description?: string;
  members: OfflineTeamMember[];
  goal?: any;
  lastSynced: number;
  isStale: boolean;
}

export interface OfflineTeamMember {
  id: string;
  name: string;
  avatarUrl?: string;
  role: 'admin' | 'member';
  isOnline?: boolean;
}

export interface SyncQueueItem {
  id: string;
  type: 'activity' | 'team' | 'profile';
  priority: 'high' | 'medium' | 'low';
  data: any;
  timestamp: number;
  retries: number;
  maxRetries: number;
  nextRetryTime?: number;
}

export interface OfflineAnalyticsEvent {
  id: string;
  event: string;
  properties: any;
  timestamp: number;
  synced: boolean;
}

const DB_NAME = 'MileQuestOffline';
const DB_VERSION = 2;

export class OfflineDB {
  private db: IDBDatabase | null = null;

  async open(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Activities store
        if (!db.objectStoreNames.contains('activities')) {
          const activityStore = db.createObjectStore('activities', { keyPath: 'id' });
          activityStore.createIndex('timestamp', 'timestamp');
          activityStore.createIndex('status', 'status');
          activityStore.createIndex('checksum', 'checksum');
        }

        // Teams store
        if (!db.objectStoreNames.contains('teams')) {
          const teamStore = db.createObjectStore('teams', { keyPath: 'id' });
          teamStore.createIndex('lastSynced', 'lastSynced');
          teamStore.createIndex('isStale', 'isStale');
        }

        // Sync queue store
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
          syncStore.createIndex('type', 'type');
          syncStore.createIndex('priority', 'priority');
          syncStore.createIndex('timestamp', 'timestamp');
          syncStore.createIndex('nextRetryTime', 'nextRetryTime');
        }

        // Analytics store
        if (!db.objectStoreNames.contains('analytics')) {
          const analyticsStore = db.createObjectStore('analytics', { keyPath: 'id' });
          analyticsStore.createIndex('event', 'event');
          analyticsStore.createIndex('timestamp', 'timestamp');
          analyticsStore.createIndex('synced', 'synced');
        }

        // User data store
        if (!db.objectStoreNames.contains('userData')) {
          const userStore = db.createObjectStore('userData', { keyPath: 'key' });
          userStore.createIndex('lastUpdated', 'lastUpdated');
        }
      };
    });
  }

  // Activity methods
  async addActivity(activity: OfflineActivity): Promise<void> {
    const db = await this.open();
    const transaction = db.transaction(['activities'], 'readwrite');
    const store = transaction.objectStore('activities');
    await store.add(activity);
  }

  async updateActivity(activity: OfflineActivity): Promise<void> {
    const db = await this.open();
    const transaction = db.transaction(['activities'], 'readwrite');
    const store = transaction.objectStore('activities');
    await store.put(activity);
  }

  async getActivities(status?: string): Promise<OfflineActivity[]> {
    const db = await this.open();
    const transaction = db.transaction(['activities'], 'readonly');
    const store = transaction.objectStore('activities');
    
    if (status) {
      const index = store.index('status');
      return new Promise((resolve, reject) => {
        const request = index.getAll(status);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteActivity(id: string): Promise<void> {
    const db = await this.open();
    const transaction = db.transaction(['activities'], 'readwrite');
    const store = transaction.objectStore('activities');
    await store.delete(id);
  }

  // Team methods
  async saveTeam(team: OfflineTeam): Promise<void> {
    const db = await this.open();
    const transaction = db.transaction(['teams'], 'readwrite');
    const store = transaction.objectStore('teams');
    await store.put(team);
  }

  async getTeams(): Promise<OfflineTeam[]> {
    const db = await this.open();
    const transaction = db.transaction(['teams'], 'readonly');
    const store = transaction.objectStore('teams');
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getTeam(id: string): Promise<OfflineTeam | undefined> {
    const db = await this.open();
    const transaction = db.transaction(['teams'], 'readonly');
    const store = transaction.objectStore('teams');
    
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async markTeamStale(id: string): Promise<void> {
    const team = await this.getTeam(id);
    if (team) {
      team.isStale = true;
      await this.saveTeam(team);
    }
  }

  // Sync queue methods
  async addToSyncQueue(item: SyncQueueItem): Promise<void> {
    const db = await this.open();
    const transaction = db.transaction(['syncQueue'], 'readwrite');
    const store = transaction.objectStore('syncQueue');
    await store.add(item);
  }

  async getSyncQueue(type?: string): Promise<SyncQueueItem[]> {
    const db = await this.open();
    const transaction = db.transaction(['syncQueue'], 'readonly');
    const store = transaction.objectStore('syncQueue');
    
    if (type) {
      const index = store.index('type');
      return new Promise((resolve, reject) => {
        const request = index.getAll(type);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    
    // Get all items sorted by priority and timestamp
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const items = request.result;
        // Sort by priority (high -> low) then by timestamp (oldest first)
        items.sort((a, b) => {
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[a.priority] - priorityOrder[b.priority];
          }
          return a.timestamp - b.timestamp;
        });
        resolve(items);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async removeFromSyncQueue(id: string): Promise<void> {
    const db = await this.open();
    const transaction = db.transaction(['syncQueue'], 'readwrite');
    const store = transaction.objectStore('syncQueue');
    await store.delete(id);
  }

  // Analytics methods
  async logAnalyticsEvent(event: OfflineAnalyticsEvent): Promise<void> {
    const db = await this.open();
    const transaction = db.transaction(['analytics'], 'readwrite');
    const store = transaction.objectStore('analytics');
    await store.add(event);
  }

  async getUnsyncedAnalytics(): Promise<OfflineAnalyticsEvent[]> {
    const db = await this.open();
    const transaction = db.transaction(['analytics'], 'readonly');
    const store = transaction.objectStore('analytics');
    const index = store.index('synced');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(false);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async markAnalyticsSynced(ids: string[]): Promise<void> {
    const db = await this.open();
    const transaction = db.transaction(['analytics'], 'readwrite');
    const store = transaction.objectStore('analytics');
    
    for (const id of ids) {
      const request = await store.get(id);
      if (request) {
        request.synced = true;
        await store.put(request);
      }
    }
  }

  // User data methods
  async saveUserData(key: string, data: any): Promise<void> {
    const db = await this.open();
    const transaction = db.transaction(['userData'], 'readwrite');
    const store = transaction.objectStore('userData');
    
    await store.put({
      key,
      data,
      lastUpdated: Date.now(),
    });
  }

  async getUserData(key: string): Promise<any> {
    const db = await this.open();
    const transaction = db.transaction(['userData'], 'readonly');
    const store = transaction.objectStore('userData');
    
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result?.data);
      request.onerror = () => reject(request.error);
    });
  }

  // Storage management
  async getStorageEstimate(): Promise<StorageEstimate | null> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      return await navigator.storage.estimate();
    }
    return null;
  }

  async clearOldData(daysToKeep: number = 30): Promise<void> {
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    const db = await this.open();
    
    // Clear old activities
    const activityTransaction = db.transaction(['activities'], 'readwrite');
    const activityStore = activityTransaction.objectStore('activities');
    const activityIndex = activityStore.index('timestamp');
    const activityRange = IDBKeyRange.upperBound(cutoffTime);
    
    await new Promise((resolve, reject) => {
      const request = activityIndex.openCursor(activityRange);
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          if (cursor.value.status === 'synced') {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve(void 0);
        }
      };
      request.onerror = () => reject(request.error);
    });
    
    // Clear old analytics
    const analyticsTransaction = db.transaction(['analytics'], 'readwrite');
    const analyticsStore = analyticsTransaction.objectStore('analytics');
    const analyticsIndex = analyticsStore.index('timestamp');
    const analyticsRange = IDBKeyRange.upperBound(cutoffTime);
    
    await new Promise((resolve, reject) => {
      const request = analyticsIndex.openCursor(analyticsRange);
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          if (cursor.value.synced) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve(void 0);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Singleton instance
export const offlineDB = new OfflineDB();

// Utility functions
export function generateChecksum(data: any): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

export function compressData(data: any): string {
  // Simple compression using JSON.stringify
  // In production, you might use a library like lz-string
  return JSON.stringify(data);
}

export function decompressData(compressed: string): any {
  // Simple decompression
  return JSON.parse(compressed);
}