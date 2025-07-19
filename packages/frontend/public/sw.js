/**
 * Mile Quest Service Worker
 * Handles caching strategies, offline support, and push notifications
 */

const CACHE_VERSION = 'mile-quest-v2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const API_CACHE = `${CACHE_VERSION}-api`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;
const DATA_CACHE = `${CACHE_VERSION}-data`;

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/activities',
  '/teams',
  '/signin',
  '/signup',
  '/offline',
  '/_next/static/css/app/layout.css',
  '/_next/static/css/app/page.css',
  // Add other critical static assets
];

// API routes that should be cached
const API_ROUTES = [
  '/api/dashboard',
  '/api/activities',
  '/api/teams',
  '/api/users/me',
];

// Maximum cache sizes
const MAX_DYNAMIC_CACHE_SIZE = 50;
const MAX_API_CACHE_SIZE = 30;
const MAX_IMAGE_CACHE_SIZE = 100;
const MAX_DATA_CACHE_SIZE = 200;

// Cache duration in milliseconds
const CACHE_DURATION = {
  STATIC: 30 * 24 * 60 * 60 * 1000, // 30 days
  DYNAMIC: 24 * 60 * 60 * 1000,     // 1 day
  API: 5 * 60 * 1000,               // 5 minutes
  IMAGE: 7 * 24 * 60 * 60 * 1000,   // 7 days
  DATA: 24 * 60 * 60 * 1000,        // 1 day
};

// Network timeout for fetch operations
const NETWORK_TIMEOUT = 5000; // 5 seconds

// Sync retry configuration
const SYNC_RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 60000,    // 1 minute
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached successfully');
        self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName.startsWith('mile-quest-') && !cacheName.startsWith(CACHE_VERSION)) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Old caches cleaned up');
        self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }

  // Handle API requests with network-first strategy
  if (isApiRequest(url)) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Handle static assets with cache-first strategy
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // Handle navigation requests with stale-while-revalidate strategy
  if (request.mode === 'navigate') {
    event.respondWith(staleWhileRevalidateStrategy(request));
    return;
  }

  // Default to stale-while-revalidate for other requests
  event.respondWith(staleWhileRevalidateStrategy(request));
});

// Enhanced network-first strategy with intelligent caching
async function networkFirstStrategy(request) {
  const url = new URL(request.url);
  const isDataRequest = url.pathname.includes('/dashboard') || 
                       url.pathname.includes('/teams') ||
                       url.pathname.includes('/activities');
  
  try {
    console.log('[SW] Network-first:', request.url);
    
    // Try network with timeout
    const networkResponse = await fetchWithTimeout(request, {}, NETWORK_TIMEOUT);
    
    if (networkResponse.ok) {
      // Cache successful responses
      const cache = await caches.open(isDataRequest ? DATA_CACHE : API_CACHE);
      const responseToCache = networkResponse.clone();
      
      // Add cache metadata
      const headers = new Headers(responseToCache.headers);
      headers.set('X-Cache-Time', Date.now().toString());
      
      const cachedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers,
      });
      
      await cache.put(request, cachedResponse);
      await limitCacheSize(
        isDataRequest ? DATA_CACHE : API_CACHE,
        isDataRequest ? MAX_DATA_CACHE_SIZE : MAX_API_CACHE_SIZE
      );
      
      return networkResponse;
    }
    
    throw new Error('Network response not ok');
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    
    // Try cache with freshness check
    const cachedResponse = await getCachedResponseWithFreshness(
      request,
      isDataRequest ? DATA_CACHE : API_CACHE,
      isDataRequest ? CACHE_DURATION.DATA : CACHE_DURATION.API
    );
    
    if (cachedResponse) {
      // Add stale header if cache is old
      const headers = new Headers(cachedResponse.headers);
      headers.set('X-From-Cache', 'true');
      
      const cacheTime = parseInt(headers.get('X-Cache-Time') || '0');
      const age = Date.now() - cacheTime;
      
      if (age > (isDataRequest ? CACHE_DURATION.DATA : CACHE_DURATION.API)) {
        headers.set('X-Cache-Stale', 'true');
      }
      
      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers: headers,
      });
    }
    
    // Return offline response
    return createOfflineResponse(request);
  }
}

// Get cached response with freshness check
async function getCachedResponseWithFreshness(request, cacheName, maxAge) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  if (!cachedResponse) return null;
  
  const cacheTime = parseInt(cachedResponse.headers.get('X-Cache-Time') || '0');
  const age = Date.now() - cacheTime;
  
  // Return cached response regardless of age (stale-while-revalidate)
  return cachedResponse;
}

// Create offline response based on request type
function createOfflineResponse(request) {
  const url = new URL(request.url);
  
  // For API requests, return JSON error
  if (url.pathname.startsWith('/api/')) {
    return new Response(
      JSON.stringify({
        error: 'Offline',
        message: 'This feature requires an internet connection',
        offline: true,
      }),
      { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
  
  // For navigation requests, return offline page
  if (request.mode === 'navigate') {
    return caches.match('/offline');
  }
  
  // Default offline response
  return new Response('Content not available offline', { status: 503 });
}

// Cache-first strategy (for static assets)
async function cacheFirstStrategy(request) {
  console.log('[SW] Cache-first:', request.url);
  
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // If not in cache, fetch from network and cache
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('[SW] Failed to fetch static asset:', error);
    return new Response('Asset not available offline', { status: 503 });
  }
}

// Stale-while-revalidate strategy (for pages and dynamic content)
async function staleWhileRevalidateStrategy(request) {
  console.log('[SW] Stale-while-revalidate:', request.url);
  
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await cache.match(request);
  
  // Fetch from network in background
  const networkPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
        limitCacheSize(DYNAMIC_CACHE, MAX_DYNAMIC_CACHE_SIZE);
      }
      return networkResponse;
    })
    .catch((error) => {
      console.log('[SW] Network fetch failed:', error);
      return null;
    });
  
  // Return cached version immediately if available
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // Otherwise wait for network
  const networkResponse = await networkPromise;
  if (networkResponse) {
    return networkResponse;
  }
  
  // If both fail and it's a navigation request, return offline page
  if (request.mode === 'navigate') {
    return caches.match('/offline');
  }
  
  return new Response('Content not available offline', { status: 503 });
}

// Helper functions
function isApiRequest(url) {
  return url.pathname.startsWith('/api/') || 
         url.hostname !== self.location.hostname ||
         API_ROUTES.some(route => url.pathname.startsWith(route));
}

function isStaticAsset(url) {
  return url.pathname.includes('/_next/static/') ||
         url.pathname.match(/\.(js|css|woff|woff2|png|jpg|jpeg|gif|svg|ico)$/);
}

async function limitCacheSize(cacheName, maxSize) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  if (keys.length > maxSize) {
    // Remove oldest entries
    const keysToDelete = keys.slice(0, keys.length - maxSize);
    await Promise.all(keysToDelete.map(key => cache.delete(key)));
  }
}

// Push notification handling
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  if (!event.data) {
    console.log('[SW] Push event has no data');
    return;
  }
  
  try {
    const data = event.data.json();
    console.log('[SW] Push data:', data);
    
    const options = {
      body: data.body || 'Mile Quest notification',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      tag: data.tag || 'mile-quest-notification',
      data: data.data || {},
      actions: data.actions || [],
      requireInteraction: data.requireInteraction || false,
      silent: data.silent || false,
      vibrate: data.vibrate || [200, 100, 200],
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'Mile Quest', options)
    );
  } catch (error) {
    console.error('[SW] Error parsing push data:', error);
    
    // Show default notification
    event.waitUntil(
      self.registration.showNotification('Mile Quest', {
        body: 'You have a new notification',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
      })
    );
  }
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification);
  
  event.notification.close();
  
  const data = event.notification.data || {};
  const actionId = event.action;
  
  // Handle action buttons
  if (actionId === 'view') {
    event.waitUntil(
      clients.openWindow(data.url || '/')
    );
    return;
  }
  
  if (actionId === 'dismiss') {
    return;
  }
  
  // Default action - open the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If app is already open, focus it
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Otherwise open new window
        if (clients.openWindow) {
          return clients.openWindow(data.url || '/');
        }
      })
  );
});

// Enhanced background sync with multiple sync types
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  switch (event.tag) {
    case 'sync-activities':
      event.waitUntil(syncOfflineActivities());
      break;
    case 'sync-team-progress':
      event.waitUntil(syncTeamProgress());
      break;
    case 'sync-all-data':
      event.waitUntil(syncAllData());
      break;
    case 'sync-analytics':
      event.waitUntil(syncAnalytics());
      break;
    default:
      // Handle dynamic sync tags for retry operations
      if (event.tag.startsWith('retry-')) {
        event.waitUntil(handleRetrySync(event.tag));
      }
  }
});

// Comprehensive data sync
async function syncAllData() {
  console.log('[SW] Starting comprehensive data sync...');
  
  try {
    // Sync in priority order
    await syncOfflineActivities();
    await syncTeamProgress();
    await syncAnalytics();
    await cleanupOldData();
    
    // Notify clients
    await notifyClients('sync-all-complete', { timestamp: Date.now() });
  } catch (error) {
    console.error('[SW] Comprehensive sync failed:', error);
  }
}

// Sync analytics events
async function syncAnalytics() {
  try {
    const db = await openIndexedDB();
    const events = await getUnsyncedAnalytics(db);
    
    if (events.length === 0) return;
    
    // Batch send analytics
    const response = await fetch('/api/analytics/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
    });
    
    if (response.ok) {
      await markAnalyticsSynced(db, events.map(e => e.id));
      console.log('[SW] Synced analytics events:', events.length);
    }
  } catch (error) {
    console.error('[SW] Analytics sync failed:', error);
  }
}

// Handle retry sync operations
async function handleRetrySync(tag) {
  const parts = tag.split('-');
  const type = parts[1];
  const id = parts.slice(2).join('-');
  
  console.log('[SW] Retrying sync for:', type, id);
  
  const db = await openIndexedDB();
  const syncItem = await getSyncQueueItem(db, id);
  
  if (syncItem && Date.now() >= syncItem.nextRetryTime) {
    switch (type) {
      case 'activity':
        await syncOfflineActivities();
        break;
      // Add other retry types as needed
    }
  }
}

// Enhanced sync with conflict resolution and retry logic
async function syncOfflineActivities() {
  try {
    console.log('[SW] Starting enhanced offline sync...');
    
    const db = await openIndexedDB();
    const pendingActivities = await getPendingActivities(db);
    const syncResults = { synced: 0, failed: 0, conflicts: 0 };
    
    for (const activity of pendingActivities) {
      try {
        // Update sync attempt
        activity.syncAttempts = (activity.syncAttempts || 0) + 1;
        activity.lastSyncAttempt = Date.now();
        await updateActivity(db, activity);
        
        // Attempt sync with timeout
        const response = await fetchWithTimeout('/api/activities', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Checksum': activity.checksum || '',
          },
          body: JSON.stringify(activity.data),
        }, NETWORK_TIMEOUT);
        
        if (response.ok) {
          await removeOfflineActivity(db, activity.id);
          syncResults.synced++;
          console.log('[SW] Synced activity:', activity.id);
        } else if (response.status === 409) {
          // Conflict detected
          activity.status = 'conflict';
          activity.conflictData = await response.json();
          await updateActivity(db, activity);
          syncResults.conflicts++;
        } else {
          throw new Error(`Sync failed: ${response.status}`);
        }
      } catch (error) {
        console.error('[SW] Failed to sync activity:', error);
        
        // Mark as failed after max retries
        if (activity.syncAttempts >= SYNC_RETRY_CONFIG.maxRetries) {
          activity.status = 'failed';
          await updateActivity(db, activity);
        } else {
          // Schedule retry
          await scheduleRetry(db, activity);
        }
        syncResults.failed++;
      }
    }
    
    // Notify clients of sync results
    await notifyClients('sync-complete', syncResults);
    
  } catch (error) {
    console.error('[SW] Enhanced sync failed:', error);
  }
}

// Fetch with timeout
async function fetchWithTimeout(url, options, timeout) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Schedule retry for failed sync
async function scheduleRetry(db, activity) {
  const delay = Math.min(
    SYNC_RETRY_CONFIG.initialDelay * Math.pow(2, activity.syncAttempts - 1),
    SYNC_RETRY_CONFIG.maxDelay
  );
  
  const retryItem = {
    id: `retry_${activity.id}_${Date.now()}`,
    type: 'activity',
    priority: 'medium',
    data: activity,
    timestamp: Date.now(),
    nextRetryTime: Date.now() + delay,
  };
  
  await addToSyncQueue(db, retryItem);
}

// Sync team progress data
async function syncTeamProgress() {
  try {
    console.log('[SW] Syncing team progress...');
    
    // Update team progress data
    const response = await fetch('/api/teams/progress');
    if (response.ok) {
      const data = await response.json();
      
      // Cache updated progress data
      const cache = await caches.open(API_CACHE);
      await cache.put('/api/teams/progress', new Response(JSON.stringify(data)));
    }
  } catch (error) {
    console.error('[SW] Failed to sync team progress:', error);
  }
}

// Enhanced IndexedDB helper functions
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('MileQuestOffline', 2);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
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
      }
      
      // Analytics store
      if (!db.objectStoreNames.contains('analytics')) {
        const analyticsStore = db.createObjectStore('analytics', { keyPath: 'id' });
        analyticsStore.createIndex('event', 'event');
        analyticsStore.createIndex('timestamp', 'timestamp');
        analyticsStore.createIndex('synced', 'synced');
      }
    };
  });
}

function getOfflineActivities(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['activities'], 'readonly');
    const store = transaction.objectStore('activities');
    const request = store.getAll();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function removeOfflineActivity(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['activities'], 'readwrite');
    const store = transaction.objectStore('activities');
    const request = store.delete(id);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Enhanced message handling with more operations
self.addEventListener('message', (event) => {
  const { type, payload } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CACHE_ACTIVITY':
      cacheOfflineActivity(payload);
      break;
      
    case 'CACHE_TEAM':
      cacheOfflineTeam(payload);
      break;
      
    case 'GET_CACHE_INFO':
      getCacheInfo().then(info => {
        event.ports[0].postMessage(info);
      });
      break;
      
    case 'GET_SYNC_STATUS':
      getSyncStatus().then(status => {
        event.ports[0].postMessage(status);
      });
      break;
      
    case 'FORCE_SYNC':
      syncAllData();
      break;
      
    case 'CLEAR_OLD_DATA':
      cleanupOldData();
      break;
      
    case 'LOG_ANALYTICS':
      logOfflineAnalytics(payload);
      break;
      
    default:
      console.log('[SW] Unknown message type:', type);
  }
});

// Cache offline team data
async function cacheOfflineTeam(teamData) {
  try {
    const db = await openIndexedDB();
    const transaction = db.transaction(['teams'], 'readwrite');
    const store = transaction.objectStore('teams');
    
    await store.put({
      ...teamData,
      lastSynced: Date.now(),
      isStale: false,
    });
    
    console.log('[SW] Team cached for offline access');
  } catch (error) {
    console.error('[SW] Failed to cache team:', error);
  }
}

// Log offline analytics
async function logOfflineAnalytics(eventData) {
  try {
    const db = await openIndexedDB();
    const transaction = db.transaction(['analytics'], 'readwrite');
    const store = transaction.objectStore('analytics');
    
    await store.add({
      id: `analytics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...eventData,
      timestamp: Date.now(),
      synced: false,
    });
    
    console.log('[SW] Analytics event logged for offline sync');
  } catch (error) {
    console.error('[SW] Failed to log analytics:', error);
  }
}

// Get sync status
async function getSyncStatus() {
  const db = await openIndexedDB();
  
  const [pendingActivities, syncQueue, unsyncedAnalytics] = await Promise.all([
    getPendingActivities(db),
    getSyncQueue(db),
    getUnsyncedAnalytics(db),
  ]);
  
  return {
    pendingActivities: pendingActivities.length,
    syncQueueSize: syncQueue.length,
    unsyncedAnalytics: unsyncedAnalytics.length,
    lastSync: await getLastSyncTime(),
  };
}

// Cleanup old data
async function cleanupOldData() {
  try {
    const db = await openIndexedDB();
    const cutoffTime = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days
    
    // Clean up old synced activities
    await cleanupOldActivities(db, cutoffTime);
    
    // Clean up old analytics
    await cleanupOldAnalytics(db, cutoffTime);
    
    // Clean up old caches
    await cleanupOldCaches();
    
    console.log('[SW] Old data cleanup completed');
  } catch (error) {
    console.error('[SW] Cleanup failed:', error);
  }
}

// Cache activity for offline sync
async function cacheOfflineActivity(activityData) {
  try {
    const db = await openIndexedDB();
    const transaction = db.transaction(['activities'], 'readwrite');
    const store = transaction.objectStore('activities');
    
    await store.add({
      id: Date.now(),
      data: activityData,
      timestamp: Date.now(),
    });
    
    console.log('[SW] Activity cached for offline sync');
  } catch (error) {
    console.error('[SW] Failed to cache offline activity:', error);
  }
}

// Get cache information
async function getCacheInfo() {
  const cacheNames = await caches.keys();
  const info = {};
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    info[cacheName] = keys.length;
  }
  
  return info;
}

// Additional helper functions for enhanced sync
async function getPendingActivities(db) {
  const transaction = db.transaction(['activities'], 'readonly');
  const store = transaction.objectStore('activities');
  const index = store.index('status');
  
  return new Promise((resolve, reject) => {
    const request = index.getAll('pending');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function updateActivity(db, activity) {
  const transaction = db.transaction(['activities'], 'readwrite');
  const store = transaction.objectStore('activities');
  
  return new Promise((resolve, reject) => {
    const request = store.put(activity);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function addToSyncQueue(db, item) {
  const transaction = db.transaction(['syncQueue'], 'readwrite');
  const store = transaction.objectStore('syncQueue');
  
  return new Promise((resolve, reject) => {
    const request = store.add(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getSyncQueue(db) {
  const transaction = db.transaction(['syncQueue'], 'readonly');
  const store = transaction.objectStore('syncQueue');
  
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getSyncQueueItem(db, id) {
  const transaction = db.transaction(['syncQueue'], 'readonly');
  const store = transaction.objectStore('syncQueue');
  
  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getUnsyncedAnalytics(db) {
  const transaction = db.transaction(['analytics'], 'readonly');
  const store = transaction.objectStore('analytics');
  const index = store.index('synced');
  
  return new Promise((resolve, reject) => {
    const request = index.getAll(false);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function markAnalyticsSynced(db, ids) {
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

async function getLastSyncTime() {
  // Store last sync time in cache metadata
  const cache = await caches.open('mile-quest-metadata');
  const response = await cache.match('last-sync-time');
  if (response) {
    const data = await response.json();
    return data.timestamp;
  }
  return 0;
}

async function cleanupOldActivities(db, cutoffTime) {
  const transaction = db.transaction(['activities'], 'readwrite');
  const store = transaction.objectStore('activities');
  const index = store.index('timestamp');
  const range = IDBKeyRange.upperBound(cutoffTime);
  
  return new Promise((resolve, reject) => {
    const request = index.openCursor(range);
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        if (cursor.value.status === 'synced') {
          cursor.delete();
        }
        cursor.continue();
      } else {
        resolve();
      }
    };
    request.onerror = () => reject(request.error);
  });
}

async function cleanupOldAnalytics(db, cutoffTime) {
  const transaction = db.transaction(['analytics'], 'readwrite');
  const store = transaction.objectStore('analytics');
  const index = store.index('timestamp');
  const range = IDBKeyRange.upperBound(cutoffTime);
  
  return new Promise((resolve, reject) => {
    const request = index.openCursor(range);
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        if (cursor.value.synced) {
          cursor.delete();
        }
        cursor.continue();
      } else {
        resolve();
      }
    };
    request.onerror = () => reject(request.error);
  });
}

async function cleanupOldCaches() {
  const cacheNames = await caches.keys();
  const cacheWhitelist = [STATIC_CACHE, DYNAMIC_CACHE, API_CACHE, IMAGE_CACHE, DATA_CACHE];
  
  await Promise.all(
    cacheNames.map(async (cacheName) => {
      if (!cacheWhitelist.includes(cacheName) && !cacheName.includes('mile-quest')) {
        await caches.delete(cacheName);
      }
    })
  );
}

// Notify all clients of events
async function notifyClients(type, data) {
  const clients = await self.clients.matchAll({ type: 'window' });
  
  clients.forEach(client => {
    client.postMessage({
      type: `sw-${type}`,
      data,
    });
  });
}

console.log('[SW] Service worker loaded');