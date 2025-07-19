/**
 * Advanced offline sync hook with conflict resolution and smart prioritization
 */

import { useState, useEffect, useCallback } from 'react';
import { offlineDB, OfflineActivity, OfflineTeam, OfflineAnalyticsEvent } from '@/services/offline/db';
import { offlineSyncService, SyncResult } from '@/services/offline/sync';
import { useOnlineStatus } from './useOnlineStatus';

interface UseAdvancedOfflineSyncReturn {
  // State
  pendingActivities: OfflineActivity[];
  failedActivities: OfflineActivity[];
  conflictedActivities: OfflineActivity[];
  offlineTeams: OfflineTeam[];
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  lastSyncTime: number;
  networkQuality: 'good' | 'fair' | 'poor';
  storageUsage: { used: number; quota: number; percentage: number } | null;
  
  // Actions
  syncNow: () => Promise<SyncResult>;
  resolveConflict: (activityId: string, resolution: 'local' | 'remote') => Promise<void>;
  clearFailedActivities: () => Promise<void>;
  retryFailedActivity: (activityId: string) => Promise<void>;
  refreshTeamData: (teamId: string) => Promise<void>;
  logOfflineAnalytics: (event: string, properties: any) => Promise<void>;
  
  // Computed
  hasPendingSync: boolean;
  hasConflicts: boolean;
  canSync: boolean;
}

export function useAdvancedOfflineSync(): UseAdvancedOfflineSyncReturn {
  const { isOnline } = useOnlineStatus();
  const [pendingActivities, setPendingActivities] = useState<OfflineActivity[]>([]);
  const [failedActivities, setFailedActivities] = useState<OfflineActivity[]>([]);
  const [conflictedActivities, setConflictedActivities] = useState<OfflineActivity[]>([]);
  const [offlineTeams, setOfflineTeams] = useState<OfflineTeam[]>([]);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState(0);
  const [networkQuality, setNetworkQuality] = useState<'good' | 'fair' | 'poor'>('good');
  const [storageUsage, setStorageUsage] = useState<{ used: number; quota: number; percentage: number } | null>(null);

  // Load offline data on mount
  useEffect(() => {
    loadOfflineData();
    updateStorageUsage();
    
    // Initialize sync service
    offlineSyncService.init();

    // Update sync status periodically
    const interval = setInterval(() => {
      const status = offlineSyncService.getSyncStatus();
      setLastSyncTime(status.lastSyncTime);
      setNetworkQuality(status.networkQuality as any);
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  // Reload data when online status changes
  useEffect(() => {
    if (isOnline) {
      loadOfflineData();
    }
  }, [isOnline]);

  /**
   * Load all offline data
   */
  const loadOfflineData = async () => {
    try {
      const [pending, failed, conflicted, teams] = await Promise.all([
        offlineDB.getActivities('pending'),
        offlineDB.getActivities('failed'),
        offlineDB.getActivities('conflict'),
        offlineDB.getTeams(),
      ]);

      setPendingActivities(pending);
      setFailedActivities(failed);
      setConflictedActivities(conflicted);
      setOfflineTeams(teams);
    } catch (error) {
      console.error('[OfflineSync] Failed to load offline data:', error);
    }
  };

  /**
   * Update storage usage information
   */
  const updateStorageUsage = async () => {
    try {
      const estimate = await offlineDB.getStorageEstimate();
      if (estimate && estimate.usage !== undefined && estimate.quota !== undefined) {
        setStorageUsage({
          used: estimate.usage,
          quota: estimate.quota,
          percentage: (estimate.usage / estimate.quota) * 100,
        });
      }
    } catch (error) {
      console.error('[OfflineSync] Failed to get storage estimate:', error);
    }
  };

  /**
   * Sync now
   */
  const syncNow = useCallback(async (): Promise<SyncResult> => {
    if (!isOnline || syncStatus === 'syncing') {
      return {
        success: false,
        synced: 0,
        failed: 0,
        conflicts: 0,
        errors: ['Cannot sync while offline or sync in progress'],
      };
    }

    setSyncStatus('syncing');

    try {
      const result = await offlineSyncService.forceSync();
      
      if (result.success) {
        setSyncStatus('success');
      } else {
        setSyncStatus('error');
      }

      // Reload data after sync
      await loadOfflineData();
      await updateStorageUsage();

      // Reset status after delay
      setTimeout(() => setSyncStatus('idle'), 3000);

      return result;
    } catch (error) {
      console.error('[OfflineSync] Sync failed:', error);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 3000);
      
      return {
        success: false,
        synced: 0,
        failed: 0,
        conflicts: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }, [isOnline, syncStatus]);

  /**
   * Resolve a conflict
   */
  const resolveConflict = useCallback(async (activityId: string, resolution: 'local' | 'remote'): Promise<void> => {
    try {
      const activity = conflictedActivities.find(a => a.id === activityId);
      if (!activity) return;

      if (resolution === 'local') {
        // Use local data
        activity.status = 'pending';
        activity.conflictData = null;
      } else {
        // Use remote data
        if (activity.conflictData) {
          activity.data = activity.conflictData;
          activity.status = 'pending';
          activity.conflictData = null;
        }
      }

      await offlineDB.updateActivity(activity);
      await loadOfflineData();

      // Trigger sync to process resolved conflict
      if (isOnline) {
        syncNow();
      }
    } catch (error) {
      console.error('[OfflineSync] Failed to resolve conflict:', error);
    }
  }, [conflictedActivities, isOnline, syncNow]);

  /**
   * Clear all failed activities
   */
  const clearFailedActivities = useCallback(async (): Promise<void> => {
    try {
      for (const activity of failedActivities) {
        await offlineDB.deleteActivity(activity.id);
      }
      setFailedActivities([]);
    } catch (error) {
      console.error('[OfflineSync] Failed to clear failed activities:', error);
    }
  }, [failedActivities]);

  /**
   * Retry a failed activity
   */
  const retryFailedActivity = useCallback(async (activityId: string): Promise<void> => {
    try {
      const activity = failedActivities.find(a => a.id === activityId);
      if (!activity) return;

      // Reset to pending status
      activity.status = 'pending';
      activity.syncAttempts = 0;
      await offlineDB.updateActivity(activity);

      await loadOfflineData();

      // Trigger sync if online
      if (isOnline) {
        syncNow();
      }
    } catch (error) {
      console.error('[OfflineSync] Failed to retry activity:', error);
    }
  }, [failedActivities, isOnline, syncNow]);

  /**
   * Refresh team data
   */
  const refreshTeamData = useCallback(async (teamId: string): Promise<void> => {
    try {
      await offlineDB.markTeamStale(teamId);
      
      if (isOnline) {
        await syncNow();
      }
    } catch (error) {
      console.error('[OfflineSync] Failed to refresh team data:', error);
    }
  }, [isOnline, syncNow]);

  /**
   * Log offline analytics event
   */
  const logOfflineAnalytics = useCallback(async (event: string, properties: any): Promise<void> => {
    try {
      const analyticsEvent: OfflineAnalyticsEvent = {
        id: `analytics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        event,
        properties,
        timestamp: Date.now(),
        synced: false,
      };

      await offlineDB.logAnalyticsEvent(analyticsEvent);
    } catch (error) {
      console.error('[OfflineSync] Failed to log analytics event:', error);
    }
  }, []);

  return {
    // State
    pendingActivities,
    failedActivities,
    conflictedActivities,
    offlineTeams,
    syncStatus,
    lastSyncTime,
    networkQuality,
    storageUsage,

    // Actions
    syncNow,
    resolveConflict,
    clearFailedActivities,
    retryFailedActivity,
    refreshTeamData,
    logOfflineAnalytics,

    // Computed
    hasPendingSync: pendingActivities.length > 0 || failedActivities.length > 0,
    hasConflicts: conflictedActivities.length > 0,
    canSync: isOnline && syncStatus !== 'syncing',
  };
}

export default useAdvancedOfflineSync;