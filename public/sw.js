const CACHE_NAME = 'agent-zero-v1'
const OFFLINE_URL = '/'

// Assets to cache on install
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS)
    })
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    })
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.status === 200) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone)
          })
        }
        return response
      })
      .catch(() => {
        // Serve from cache on network failure
        return caches.match(event.request).then((cached) => {
          if (cached) return cached
          // Fallback to offline page for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match(OFFLINE_URL)
          }
          return new Response('Offline', { status: 503 })
        })
      })
  )
})

// Push notification handling
self.addEventListener('push', (event) => {
  let data = { title: 'Agent Zero', body: 'New notification', type: 'info' }

  try {
    data = event.data.json()
  } catch {
    data.body = event.data?.text() || data.body
  }

  const iconMap = {
    alert: '/icon-192.png',
    task: '/icon-192.png',
    info: '/icon-192.png',
    system: '/icon-192.png',
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: iconMap[data.type] || '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      tag: data.type,
      renotify: true,
      data: { url: '/' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      // Focus existing window or open new one
      for (const client of clients) {
        if ('focus' in client) return client.focus()
      }
      return self.clients.openWindow(event.notification.data?.url || '/')
    })
  )
})
