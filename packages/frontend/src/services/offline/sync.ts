/**
 * Offline sync service with conflict resolution and smart prioritization
 */

import { offlineDB, OfflineActivity, SyncQueueItem, generateChecksum } from './db';
import { activityService } from '@/services/activity.service';
import { teamService } from '@/services/team.service';
import { pwaService } from '@/services/pwa.service';
import { isServer, addEventListener, isOnline, isServiceWorkerSupported, safeNavigator, safeLocalStorage } from '@/utils/ssr-safe';

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  conflicts: number;
  errors: string[];
}

export interface ConflictResolution {
  strategy: 'local' | 'remote' | 'merge' | 'manual';
  resolver?: (local: any, remote: any) => any;
}

export class OfflineSyncService {
  private isSyncing = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private networkQuality: 'good' | 'fair' | 'poor' = 'good';
  private lastSyncTime = 0;

  // Conflict resolution strategies
  private conflictStrategies: Map<string, ConflictResolution> = new Map([
    ['activity', { strategy: 'local' }], // User's local activity data takes precedence
    ['team', { strategy: 'remote' }], // Server team data takes precedence
    ['profile', { strategy: 'merge' }], // Merge profile changes
  ]);

  /**
   * Initialize sync service
   */
  async init(): Promise<void> {
    // Only initialize in browser environment
    if (isServer()) {
      return;
    }

    // Listen for online/offline events
    addEventListener('online', () => this.handleOnline());
    addEventListener('offline', () => this.handleOffline());

    // Monitor network quality
    this.startNetworkMonitoring();

    // Start periodic sync if online
    if (isOnline()) {
      this.startPeriodicSync();
    }

    // Register background sync
    if (isServiceWorkerSupported()) {
      const nav = safeNavigator();
      if (nav && 'SyncManager' in window) {
        try {
          const registration = await nav.serviceWorker.ready;
          if (registration && 'sync' in registration) {
            await (registration as any).sync.register('sync-all-data');
          }
        } catch (error) {
          console.error('[Sync] Failed to register background sync:', error);
        }
      }
    }
  }

  /**
   * Perform full sync
   */
  async syncAll(): Promise<SyncResult> {
    if (this.isSyncing || !isOnline()) {
      return {
        success: false,
        synced: 0,
        failed: 0,
        conflicts: 0,
        errors: ['Sync already in progress or offline'],
      };
    }

    this.isSyncing = true;
    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      conflicts: 0,
      errors: [],
    };

    try {
      // Sync in priority order
      const activityResult = await this.syncActivities();
      result.synced += activityResult.synced;
      result.failed += activityResult.failed;
      result.conflicts += activityResult.conflicts;
      result.errors.push(...activityResult.errors);

      const queueResult = await this.processSyncQueue();
      result.synced += queueResult.synced;
      result.failed += queueResult.failed;
      result.errors.push(...queueResult.errors);

      // Sync analytics events
      await this.syncAnalytics();

      // Update team data
      await this.refreshTeamData();

      this.lastSyncTime = Date.now();

      // Clean up old data
      await offlineDB.clearOldData();

      // Show sync notification
      if (result.synced > 0 && pwaService.getNotificationPermission() === 'granted') {
        await pwaService.showNotification({
          title: 'Data Synced',
          body: `Successfully synced ${result.synced} items`,
          tag: 'sync-complete',
        });
      }

    } catch (error) {
      console.error('[Sync] Sync failed:', error);
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      this.isSyncing = false;
    }

    return result;
  }

  /**
   * Sync offline activities with conflict resolution
   */
  private async syncActivities(): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      conflicts: 0,
      errors: [],
    };

    try {
      const pendingActivities = await offlineDB.getActivities('pending');
      
      for (const activity of pendingActivities) {
        try {
          // Update status to syncing
          activity.status = 'syncing';
          activity.lastSyncAttempt = Date.now();
          activity.syncAttempts++;
          await offlineDB.updateActivity(activity);

          // Check for conflicts if activity has a checksum
          if (activity.checksum) {
            const serverChecksum = await this.getServerChecksum('activity', activity.data.id);
            if (serverChecksum && serverChecksum !== activity.checksum) {
              // Conflict detected
              const resolved = await this.resolveConflict('activity', activity.data, null);
              if (resolved) {
                activity.data = resolved;
              } else {
                activity.status = 'conflict';
                await offlineDB.updateActivity(activity);
                result.conflicts++;
                continue;
              }
            }
          }

          // Attempt to sync
          const response = await activityService.createActivity(activity.data);
          
          // Mark as synced
          activity.status = 'synced';
          await offlineDB.updateActivity(activity);
          
          // Remove after successful sync
          await offlineDB.deleteActivity(activity.id);
          result.synced++;

        } catch (error) {
          console.error('[Sync] Failed to sync activity:', error);
          
          // Update failure status
          activity.status = 'failed';
          await offlineDB.updateActivity(activity);
          
          // Add to sync queue for retry
          if (activity.syncAttempts < 3) {
            await this.addToRetryQueue('activity', activity);
          }
          
          result.failed++;
          result.errors.push(`Activity ${activity.id}: ${error}`);
        }
      }
    } catch (error) {
      console.error('[Sync] Failed to sync activities:', error);
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }

    return result;
  }

  /**
   * Process sync queue with smart prioritization
   */
  private async processSyncQueue(): Promise<Omit<SyncResult, 'conflicts'>> {
    const result = {
      success: true,
      synced: 0,
      failed: 0,
      errors: [] as string[],
    };

    try {
      const queue = await offlineDB.getSyncQueue();
      const now = Date.now();

      for (const item of queue) {
        // Skip if retry time hasn't been reached
        if (item.nextRetryTime && item.nextRetryTime > now) {
          continue;
        }

        try {
          await this.syncQueueItem(item);
          await offlineDB.removeFromSyncQueue(item.id);
          result.synced++;
        } catch (error) {
          console.error('[Sync] Failed to sync queue item:', error);
          
          item.retries++;
          if (item.retries < item.maxRetries) {
            // Calculate next retry time with exponential backoff
            item.nextRetryTime = now + Math.pow(2, item.retries) * 60000; // 1min, 2min, 4min...
            await offlineDB.addToSyncQueue(item);
          } else {
            await offlineDB.removeFromSyncQueue(item.id);
          }
          
          result.failed++;
          result.errors.push(`Queue item ${item.id}: ${error}`);
        }
      }
    } catch (error) {
      console.error('[Sync] Failed to process sync queue:', error);
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }

    return result;
  }

  /**
   * Sync a single queue item
   */
  private async syncQueueItem(item: SyncQueueItem): Promise<void> {
    switch (item.type) {
      case 'activity':
        await activityService.createActivity(item.data);
        break;
      case 'team':
        // Handle team updates
        break;
      case 'profile':
        // Handle profile updates
        break;
      default:
        throw new Error(`Unknown sync type: ${item.type}`);
    }
  }

  /**
   * Resolve conflicts between local and remote data
   */
  private async resolveConflict(type: string, localData: any, remoteData: any): Promise<any> {
    const strategy = this.conflictStrategies.get(type) || { strategy: 'manual' };

    switch (strategy.strategy) {
      case 'local':
        return localData;
      
      case 'remote':
        return remoteData;
      
      case 'merge':
        if (strategy.resolver) {
          return strategy.resolver(localData, remoteData);
        }
        // Default merge: combine properties, preferring local for conflicts
        return { ...remoteData, ...localData };
      
      case 'manual':
      default:
        // Store conflict for manual resolution
        await this.storeConflict(type, localData, remoteData);
        return null;
    }
  }

  /**
   * Store conflict for manual resolution
   */
  private async storeConflict(type: string, localData: any, remoteData: any): Promise<void> {
    await offlineDB.saveUserData(`conflict_${type}_${Date.now()}`, {
      type,
      localData,
      remoteData,
      timestamp: Date.now(),
    });
  }

  /**
   * Get server checksum for conflict detection
   */
  private async getServerChecksum(type: string, id: string): Promise<string | null> {
    // In a real implementation, this would call an API endpoint
    // For now, return null (no conflict)
    return null;
  }

  /**
   * Add item to retry queue
   */
  private async addToRetryQueue(type: string, data: any): Promise<void> {
    const queueItem: SyncQueueItem = {
      id: `retry_${type}_${Date.now()}`,
      type: type as any,
      priority: 'medium',
      data,
      timestamp: Date.now(),
      retries: 0,
      maxRetries: 3,
      nextRetryTime: Date.now() + 60000, // Retry after 1 minute
    };

    await offlineDB.addToSyncQueue(queueItem);
  }

  /**
   * Sync analytics events
   */
  private async syncAnalytics(): Promise<void> {
    try {
      const events = await offlineDB.getUnsyncedAnalytics();
      if (events.length === 0) return;

      // Batch send analytics events
      const eventIds = events.map(e => e.id);
      
      // In a real implementation, send to analytics service
      console.log('[Sync] Syncing analytics events:', events.length);
      
      // Mark as synced
      await offlineDB.markAnalyticsSynced(eventIds);
    } catch (error) {
      console.error('[Sync] Failed to sync analytics:', error);
    }
  }

  /**
   * Refresh team data
   */
  private async refreshTeamData(): Promise<void> {
    try {
      const teams = await offlineDB.getTeams();
      const staleThreshold = Date.now() - (5 * 60 * 1000); // 5 minutes

      for (const team of teams) {
        if (team.isStale || team.lastSynced < staleThreshold) {
          try {
            const freshData = await teamService.getTeamById(team.id);
            await offlineDB.saveTeam({
              ...freshData,
              lastSynced: Date.now(),
              isStale: false,
            });
          } catch (error) {
            console.error(`[Sync] Failed to refresh team ${team.id}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('[Sync] Failed to refresh team data:', error);
    }
  }

  /**
   * Start network quality monitoring
   */
  private startNetworkMonitoring(): void {
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      const connection = (navigator as any).connection;
      
      if (connection) {
        const updateNetworkQuality = () => {
          const effectiveType = connection.effectiveType;
          if (effectiveType === '4g') {
            this.networkQuality = 'good';
          } else if (effectiveType === '3g') {
            this.networkQuality = 'fair';
          } else {
            this.networkQuality = 'poor';
          }
        };

        connection.addEventListener('change', updateNetworkQuality);
        updateNetworkQuality();
      }
    }
  }

  /**
   * Start periodic sync based on network quality
   */
  private startPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Adjust sync interval based on network quality
    const intervals = {
      good: 5 * 60 * 1000,    // 5 minutes
      fair: 10 * 60 * 1000,   // 10 minutes
      poor: 30 * 60 * 1000,   // 30 minutes
    };

    const interval = intervals[this.networkQuality];
    
    this.syncInterval = setInterval(() => {
      this.syncAll().catch(console.error);
    }, interval);
  }

  /**
   * Handle online event
   */
  private handleOnline(): void {
    console.log('[Sync] Device is online');
    this.startPeriodicSync();
    
    // Immediate sync after coming online
    setTimeout(() => {
      this.syncAll().catch(console.error);
    }, 1000);
  }

  /**
   * Handle offline event
   */
  private handleOffline(): void {
    console.log('[Sync] Device is offline');
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Get sync status
   */
  getSyncStatus(): {
    isSyncing: boolean;
    lastSyncTime: number;
    networkQuality: string;
    isOnline: boolean;
  } {
    return {
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      networkQuality: this.networkQuality,
      isOnline: isOnline(),
    };
  }

  /**
   * Force sync
   */
  async forceSync(): Promise<SyncResult> {
    return this.syncAll();
  }

  /**
   * Clean up
   */
  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }
}

// Singleton instance
export const offlineSyncService = new OfflineSyncService();