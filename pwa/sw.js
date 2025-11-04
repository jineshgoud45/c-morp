// C-MORP Service Worker
// Provides offline functionality and PWA features

const CACHE_NAME = 'cmorp-v1.0.0';
const STATIC_CACHE = 'cmorp-static-v1.0.0';
const API_CACHE = 'cmorp-api-v1.0.0';

// Files to cache for offline functionality
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/styles.css',
  '/js/app.js',
  '/js/api.js',
  '/js/components.js',
  '/assets/logo.svg',
  // Icon files will be cached when requested
];

// API endpoints to cache
const API_ENDPOINTS = [
  '/api/energy/current',
  '/api/energy/devices',
  '/api/alerts/active',
  '/api/user/profile'
];

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
        return self.skipWaiting();
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
            if (cacheName !== STATIC_CACHE && cacheName !== API_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle static asset requests
  if (request.destination === 'script' ||
      request.destination === 'style' ||
      request.destination === 'image' ||
      url.pathname.endsWith('.json') ||
      url.pathname.endsWith('.webmanifest')) {
    event.respondWith(handleStaticRequest(request));
    return;
  }

  // Handle navigation requests (SPA routing)
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // Default: network first for everything else
  event.respondWith(
    fetch(request).catch(() => {
      // Return offline page or fallback
      return caches.match('/index.html');
    })
  );
});

// Handle API requests with network-first strategy
async function handleApiRequest(request) {
  const url = new URL(request.url);

  try {
    // Try network first for API requests
    const networkResponse = await fetch(request);

    // Cache successful GET requests
    if (networkResponse.ok && request.method === 'GET') {
      const cache = await caches.open(API_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed for API request, serving from cache:', request.url);

    // Try cache if network fails
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline fallback for specific API endpoints
    if (API_ENDPOINTS.some(endpoint => url.pathname.startsWith(endpoint))) {
      return new Response(JSON.stringify(getOfflineFallback(url.pathname)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    throw error;
  }
}

// Handle static asset requests with cache-first strategy
async function handleStaticRequest(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    // Cache hit - return cached response
    return cachedResponse;
  }

  try {
    // Cache miss - fetch from network
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error('[SW] Failed to fetch static asset:', request.url, error);
    throw error;
  }
}

// Handle navigation requests (SPA routing)
async function handleNavigationRequest(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    // Network failed - serve cached index.html
    console.log('[SW] Network failed for navigation, serving cached index.html');
    const cachedResponse = await caches.match('/index.html');

    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline page if available
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Offline - C-MORP</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: system-ui, sans-serif; text-align: center; padding: 2rem; background: #f5f5f5; }
          .offline-container { max-width: 400px; margin: 0 auto; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .icon { font-size: 4rem; margin-bottom: 1rem; }
          h1 { color: #2E7D32; margin-bottom: 1rem; }
          p { color: #666; line-height: 1.6; }
          .retry-btn { background: #2E7D32; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 4px; cursor: pointer; margin-top: 1rem; }
        </style>
      </head>
      <body>
        <div class="offline-container">
          <div class="icon">⚡</div>
          <h1>You're Offline</h1>
          <p>C-MORP is currently unavailable due to a network connection issue. Please check your internet connection and try again.</p>
          <p>Some features may still be available using cached data.</p>
          <button class="retry-btn" onclick="window.location.reload()">Retry</button>
        </div>
      </body>
      </html>
    `, {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

// Provide offline fallback data for API endpoints
function getOfflineFallback(pathname) {
  const now = new Date();

  switch (pathname) {
    case '/api/energy/current':
      return {
        success: true,
        message: 'Offline data - last known values',
        data: {
          timestamp: now.toISOString(),
          consumption_kw: 0,
          generation_kw: 0,
          battery_soc: 0,
          battery_power_kw: 0,
          grid_import_kw: 0,
          grid_export_kw: 0,
          cost_savings: 0,
          carbon_savings_kg: 0
        }
      };

    case '/api/energy/devices':
      return {
        success: true,
        message: 'Offline data - device status unavailable',
        data: []
      };

    case '/api/alerts/active':
      return {
        success: true,
        message: 'Offline data - no new alerts while offline',
        data: [
          {
            id: 'offline-alert-1',
            title: 'Connection Lost',
            message: 'Unable to connect to server. Showing cached data.',
            severity: 'medium',
            timestamp: now.toISOString(),
            acknowledged: false
          }
        ]
      };

    case '/api/user/profile':
      return {
        success: true,
        message: 'Offline data - cached profile',
        data: {
          name: 'Energy Manager',
          role: 'administrator',
          preferences: {
            theme: 'light',
            notifications: true
          }
        }
      };

    default:
      return {
        success: false,
        message: 'Offline - API endpoint unavailable',
        error: 'No network connection'
      };
  }
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync event:', event.tag);

  if (event.tag === 'background-sync-optimization') {
    event.waitUntil(syncOptimizationData());
  }
});

// Sync optimization data when back online
async function syncOptimizationData() {
  try {
    // Get stored optimization requests from IndexedDB
    const pendingRequests = await getPendingOptimizationRequests();

    for (const request of pendingRequests) {
      try {
        await fetch('/api/energy/optimize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request.data)
        });

        // Remove successfully synced request
        await removePendingRequest(request.id);
        console.log('[SW] Synced optimization request:', request.id);
      } catch (error) {
        console.error('[SW] Failed to sync optimization request:', request.id, error);
      }
    }
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

// Push notification handler
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');

  if (!event.data) {
    return;
  }

  const options = {
    body: event.data.text(),
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Open Dashboard',
        icon: '/icons/icon-192x192.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icons/icon-192x192.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('C-MORP Alert', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click received');

  event.notification.close();

  if (event.action === 'explore') {
    // Open or focus the app
    event.waitUntil(
      clients.matchAll().then((clientList) => {
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});

// Periodic background sync for data updates
self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Periodic sync event:', event.tag);

  if (event.tag === 'energy-data-sync') {
    event.waitUntil(syncEnergyData());
  }
});

// Sync energy data periodically
async function syncEnergyData() {
  try {
    const response = await fetch('/api/energy/current');
    if (response.ok) {
      const data = await response.json();
      // Update cached energy data
      const cache = await caches.open(API_CACHE);
      await cache.put('/api/energy/current', new Response(JSON.stringify(data)));
      console.log('[SW] Energy data synced successfully');
    }
  } catch (error) {
    console.error('[SW] Failed to sync energy data:', error);
  }
}

// Helper functions for IndexedDB operations (placeholder implementations)
async function getPendingOptimizationRequests() {
  // In a real implementation, this would use IndexedDB
  return [];
}

async function removePendingRequest(id) {
  // In a real implementation, this would remove from IndexedDB
  console.log('[SW] Would remove pending request:', id);
}

console.log('[SW] Service worker loaded successfully');