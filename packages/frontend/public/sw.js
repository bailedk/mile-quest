/**
 * Mile Quest Service Worker
 * Handles caching strategies, offline support, and push notifications
 */

const CACHE_VERSION = 'mile-quest-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const API_CACHE = `${CACHE_VERSION}-api`;

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

// Cache duration in milliseconds
const CACHE_DURATION = {
  STATIC: 30 * 24 * 60 * 60 * 1000, // 30 days
  DYNAMIC: 24 * 60 * 60 * 1000,     // 1 day
  API: 5 * 60 * 1000,               // 5 minutes
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

// Network-first strategy (for API calls)
async function networkFirstStrategy(request) {
  try {
    console.log('[SW] Network-first:', request.url);
    
    // Try network first
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache successful API responses
      const cache = await caches.open(API_CACHE);
      await cache.put(request, networkResponse.clone());
      await limitCacheSize(API_CACHE, MAX_API_CACHE_SIZE);
      
      return networkResponse;
    }
    
    // If network fails, try cache
    throw new Error('Network response not ok');
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page for failed API requests
    return new Response(
      JSON.stringify({ error: 'Offline', message: 'This feature requires an internet connection' }),
      { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
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

// Background sync (for offline data sync)
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'sync-activities') {
    event.waitUntil(syncOfflineActivities());
  }
  
  if (event.tag === 'sync-team-progress') {
    event.waitUntil(syncTeamProgress());
  }
});

// Sync offline activities when connection is restored
async function syncOfflineActivities() {
  try {
    console.log('[SW] Syncing offline activities...');
    
    // Get pending activities from IndexedDB
    const db = await openIndexedDB();
    const pendingActivities = await getOfflineActivities(db);
    
    for (const activity of pendingActivities) {
      try {
        const response = await fetch('/api/activities', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(activity.data),
        });
        
        if (response.ok) {
          await removeOfflineActivity(db, activity.id);
          console.log('[SW] Synced offline activity:', activity.id);
        }
      } catch (error) {
        console.error('[SW] Failed to sync activity:', error);
      }
    }
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
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

// IndexedDB helper functions
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('MileQuestOffline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('activities')) {
        const store = db.createObjectStore('activities', { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp');
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

// Handle messages from main thread
self.addEventListener('message', (event) => {
  const { type, payload } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CACHE_ACTIVITY':
      cacheOfflineActivity(payload);
      break;
      
    case 'GET_CACHE_INFO':
      getCacheInfo().then(info => {
        event.ports[0].postMessage(info);
      });
      break;
      
    default:
      console.log('[SW] Unknown message type:', type);
  }
});

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

console.log('[SW] Service worker loaded');