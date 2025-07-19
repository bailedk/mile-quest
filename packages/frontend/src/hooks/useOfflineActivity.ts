'use client';

import { useState, useEffect } from 'react';
import { pwaService } from '@/services/pwa.service';
import { activityService } from '@/services/activity.service';

interface OfflineActivity {
  id: string;
  data: any;
  timestamp: number;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
}

export function useOfflineActivity() {
  const [offlineActivities, setOfflineActivities] = useState<OfflineActivity[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');

  useEffect(() => {
    // Check initial online status
    setIsOnline(navigator.onLine);

    // Listen for online/offline events
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineActivities();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load offline activities from IndexedDB on mount
    loadOfflineActivities();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  /**
   * Submit activity with offline support
   */
  const submitActivity = async (activityData: any): Promise<{ success: boolean; offline?: boolean }> => {
    if (isOnline) {
      try {
        // Try to submit online first
        const result = await activityService.createActivity(activityData);
        
        // Show success notification if available
        if (pwaService.getNotificationPermission() === 'granted') {
          await pwaService.showNotification({
            title: 'Activity Logged!',
            body: `${activityData.distance} miles recorded successfully`,
            tag: 'activity-success',
            data: { activityId: result.id },
          });
        }
        
        return { success: true };
      } catch (error) {
        console.warn('[Offline] Online submission failed, caching for offline sync:', error);
        // Fall through to offline caching
      }
    }

    // Cache for offline sync
    try {
      const offlineActivity: OfflineActivity = {
        id: `offline-${Date.now()}`,
        data: activityData,
        timestamp: Date.now(),
        status: 'pending',
      };

      await cacheOfflineActivity(offlineActivity);
      setOfflineActivities(prev => [...prev, offlineActivity]);

      // Show offline notification if available
      if (pwaService.getNotificationPermission() === 'granted') {
        await pwaService.showNotification({
          title: 'Activity Cached',
          body: `${activityData.distance} miles saved offline. Will sync when online.`,
          tag: 'activity-offline',
          requireInteraction: false,
        });
      }

      return { success: true, offline: true };
    } catch (error) {
      console.error('[Offline] Failed to cache activity:', error);
      return { success: false };
    }
  };

  /**
   * Sync offline activities when online
   */
  const syncOfflineActivities = async (): Promise<void> => {
    if (!isOnline || offlineActivities.length === 0) {
      return;
    }

    setSyncStatus('syncing');
    const pendingActivities = offlineActivities.filter(a => a.status === 'pending');

    try {
      for (const activity of pendingActivities) {
        // Update status to syncing
        setOfflineActivities(prev => 
          prev.map(a => a.id === activity.id ? { ...a, status: 'syncing' } : a)
        );

        try {
          await activityService.createActivity(activity.data);
          
          // Mark as synced
          setOfflineActivities(prev => 
            prev.map(a => a.id === activity.id ? { ...a, status: 'synced' } : a)
          );

          // Remove from IndexedDB
          await removeOfflineActivity(activity.id);
        } catch (error) {
          console.error('[Offline] Failed to sync activity:', error);
          
          // Mark as failed
          setOfflineActivities(prev => 
            prev.map(a => a.id === activity.id ? { ...a, status: 'failed' } : a)
          );
        }
      }

      // Remove synced activities from state
      setOfflineActivities(prev => prev.filter(a => a.status !== 'synced'));
      
      setSyncStatus('success');
      
      // Show sync success notification
      if (pendingActivities.length > 0 && pwaService.getNotificationPermission() === 'granted') {
        await pwaService.showNotification({
          title: 'Activities Synced!',
          body: `${pendingActivities.length} offline activities have been synced.`,
          tag: 'sync-success',
        });
      }
    } catch (error) {
      console.error('[Offline] Sync failed:', error);
      setSyncStatus('error');
    }

    // Reset sync status after a delay
    setTimeout(() => setSyncStatus('idle'), 3000);
  };

  /**
   * Load offline activities from IndexedDB
   */
  const loadOfflineActivities = async (): Promise<void> => {
    try {
      const db = await openIndexedDB();
      const activities = await getOfflineActivitiesFromDB(db);
      setOfflineActivities(activities);
    } catch (error) {
      console.error('[Offline] Failed to load offline activities:', error);
    }
  };

  /**
   * Cache activity in IndexedDB
   */
  const cacheOfflineActivity = async (activity: OfflineActivity): Promise<void> => {
    try {
      const db = await openIndexedDB();
      const transaction = db.transaction(['activities'], 'readwrite');
      const store = transaction.objectStore('activities');
      await store.add(activity);
      
      // Also cache in service worker
      await pwaService.cacheActivityForOffline(activity.data);
    } catch (error) {
      console.error('[Offline] Failed to cache activity:', error);
      throw error;
    }
  };

  /**
   * Remove activity from IndexedDB
   */
  const removeOfflineActivity = async (activityId: string): Promise<void> => {
    try {
      const db = await openIndexedDB();
      const transaction = db.transaction(['activities'], 'readwrite');
      const store = transaction.objectStore('activities');
      await store.delete(activityId);
    } catch (error) {
      console.error('[Offline] Failed to remove activity:', error);
    }
  };

  /**
   * Retry failed activities
   */
  const retryFailedActivities = async (): Promise<void> => {
    const failedActivities = offlineActivities.filter(a => a.status === 'failed');
    
    for (const activity of failedActivities) {
      // Reset to pending status
      setOfflineActivities(prev => 
        prev.map(a => a.id === activity.id ? { ...a, status: 'pending' } : a)
      );
    }

    // Trigger sync
    await syncOfflineActivities();
  };

  /**
   * Clear all offline activities
   */
  const clearOfflineActivities = async (): Promise<void> => {
    try {
      const db = await openIndexedDB();
      const transaction = db.transaction(['activities'], 'readwrite');
      const store = transaction.objectStore('activities');
      await store.clear();
      setOfflineActivities([]);
    } catch (error) {
      console.error('[Offline] Failed to clear activities:', error);
    }
  };

  return {
    // State
    offlineActivities,
    isOnline,
    syncStatus,
    hasPendingActivities: offlineActivities.some(a => a.status === 'pending'),
    hasFailedActivities: offlineActivities.some(a => a.status === 'failed'),
    
    // Actions
    submitActivity,
    syncOfflineActivities,
    retryFailedActivities,
    clearOfflineActivities,
  };
}

// IndexedDB helper functions
function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('MileQuestOffline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains('activities')) {
        const store = db.createObjectStore('activities', { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp');
        store.createIndex('status', 'status');
      }
    };
  });
}

function getOfflineActivitiesFromDB(db: IDBDatabase): Promise<OfflineActivity[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['activities'], 'readonly');
    const store = transaction.objectStore('activities');
    const request = store.getAll();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export default useOfflineActivity;