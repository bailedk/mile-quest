/**
 * Enhanced Service Worker for Performance Optimization
 * Implements advanced caching strategies for Mile Quest
 */

const CACHE_NAME = 'mile-quest-v1';
const RUNTIME_CACHE = 'mile-quest-runtime-v1';
const IMAGE_CACHE = 'mile-quest-images-v1';
const API_CACHE = 'mile-quest-api-v1';

// Cache durations (in milliseconds)
const CACHE_DURATIONS = {
  STATIC: 7 * 24 * 60 * 60 * 1000, // 7 days
  API: 5 * 60 * 1000, // 5 minutes
  IMAGES: 30 * 24 * 60 * 60 * 1000, // 30 days
  RUNTIME: 24 * 60 * 60 * 1000, // 1 day
};

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon.svg',
  '/offline',
  // Add critical CSS and JS files
];

// API endpoints to cache with different strategies
const API_PATTERNS = {
  // Cache first for user profile data
  CACHE_FIRST: [
    /\/api\/users\/profile/,
    /\/api\/teams\/\w+\/members/,
  ],
  // Network first for real-time data
  NETWORK_FIRST: [
    /\/api\/activities/,
    /\/api\/teams\/\w+\/stats/,
    /\/api\/websocket/,
  ],
  // Stale while revalidate for team data
  STALE_WHILE_REVALIDATE: [
    /\/api\/teams/,
    /\/api\/achievements/,
  ],
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('SW: Installing service worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  
  // Force activation of new service worker
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('SW: Activating service worker...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (
            cacheName !== CACHE_NAME &&
            cacheName !== RUNTIME_CACHE &&
            cacheName !== IMAGE_CACHE &&
            cacheName !== API_CACHE
          ) {
            console.log('SW: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // Take control of all clients
  self.clients.claim();
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }
  
  // Handle different types of requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
  } else if (isImageRequest(request)) {
    event.respondWith(handleImageRequest(request));
  } else if (isStaticAsset(request)) {
    event.respondWith(handleStaticAsset(request));
  } else {
    event.respondWith(handleNavigationRequest(request));
  }
});

// API request handler with different caching strategies
async function handleApiRequest(request) {
  const url = new URL(request.url);
  
  // Determine caching strategy based on endpoint
  if (matchesPatterns(url.pathname, API_PATTERNS.CACHE_FIRST)) {
    return cacheFirst(request, API_CACHE);
  } else if (matchesPatterns(url.pathname, API_PATTERNS.NETWORK_FIRST)) {
    return networkFirst(request, API_CACHE);
  } else if (matchesPatterns(url.pathname, API_PATTERNS.STALE_WHILE_REVALIDATE)) {
    return staleWhileRevalidate(request, API_CACHE);
  } else {
    // Default to network first for unknown APIs
    return networkFirst(request, API_CACHE);
  }
}

// Image request handler with long-term caching
async function handleImageRequest(request) {
  return cacheFirst(request, IMAGE_CACHE, CACHE_DURATIONS.IMAGES);
}

// Static asset handler
async function handleStaticAsset(request) {
  return cacheFirst(request, CACHE_NAME, CACHE_DURATIONS.STATIC);
}

// Navigation request handler with offline fallback
async function handleNavigationRequest(request) {
  try {
    // Try network first for navigation
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline');
    }
    
    throw error;
  }
}

// Caching strategy implementations
async function cacheFirst(request, cacheName, maxAge = CACHE_DURATIONS.STATIC) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    const cachedDate = new Date(cachedResponse.headers.get('date') || 0);
    const now = new Date();
    
    if (now - cachedDate < maxAge) {
      return cachedResponse;
    }
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

async function networkFirst(request, cacheName, timeout = 3000) {
  const cache = await caches.open(cacheName);
  
  try {
    // Add timeout to network request
    const networkPromise = fetch(request);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Network timeout')), timeout);
    });
    
    const networkResponse = await Promise.race([networkPromise, timeoutPromise]);
    
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  // Start network request in background
  const networkPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  });
  
  // Return cached response immediately if available
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // If no cache, wait for network
  return networkPromise;
}

// Utility functions
function isImageRequest(request) {
  return request.destination === 'image' || 
         /\.(png|jpg|jpeg|gif|webp|svg|ico)$/i.test(new URL(request.url).pathname);
}

function isStaticAsset(request) {
  const url = new URL(request.url);
  return url.pathname.startsWith('/static/') ||
         url.pathname.startsWith('/_next/static/') ||
         url.pathname.endsWith('.css') ||
         url.pathname.endsWith('.js') ||
         url.pathname.endsWith('.woff') ||
         url.pathname.endsWith('.woff2');
}

function matchesPatterns(pathname, patterns) {
  return patterns.some(pattern => pattern.test(pathname));
}

// Background sync for offline activities
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync-activities') {
    event.waitUntil(syncOfflineActivities());
  }
});

async function syncOfflineActivities() {
  try {
    // Get offline activities from IndexedDB
    const offlineActivities = await getOfflineActivities();
    
    for (const activity of offlineActivities) {
      try {
        const response = await fetch('/api/activities', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(activity),
        });
        
        if (response.ok) {
          await removeOfflineActivity(activity.id);
        }
      } catch (error) {
        console.error('Failed to sync activity:', error);
      }
    }
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// Placeholder functions for IndexedDB operations
async function getOfflineActivities() {
  // This would connect to IndexedDB to get offline activities
  return [];
}

async function removeOfflineActivity(id) {
  // This would remove the synced activity from IndexedDB
}

// Push notification handler
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/icons/icon.svg',
    badge: '/icons/icon.svg',
    data: data.data,
    actions: data.actions || [],
    requireInteraction: data.requireInteraction || false,
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const data = event.notification.data;
  const action = event.action;
  
  let url = '/';
  if (data && data.url) {
    url = data.url;
  } else if (action === 'view_activity') {
    url = '/activities';
  } else if (action === 'view_team') {
    url = '/teams';
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Try to focus existing window
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Cache size management
async function manageCacheSize(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  if (keys.length > maxEntries) {
    const keysToDelete = keys.slice(0, keys.length - maxEntries);
    await Promise.all(keysToDelete.map(key => cache.delete(key)));
  }
}

// Periodic cache cleanup
setInterval(() => {
  manageCacheSize(IMAGE_CACHE, 100);
  manageCacheSize(API_CACHE, 50);
  manageCacheSize(RUNTIME_CACHE, 30);
}, 24 * 60 * 60 * 1000); // Daily cleanup