const CACHE = 'mindvault-v1'

// Cache the app shell on install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(['/', '/index.html'])
    )
  )
  self.skipWaiting()
})

// Remove old caches on activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Stale-while-revalidate for same-origin JS/CSS/HTML;
// Network-only for cross-origin (fonts, CDN), API calls, and the AI model files.
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only intercept same-origin GET requests for static assets
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  // Never cache AI model weights — they're huge and managed by @xenova/transformers
  if (url.pathname.includes('/onnx') || url.pathname.includes('/transformers-cache')) return

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request)
      const fetchPromise = fetch(request).then((response) => {
        if (response.ok) cache.put(request, response.clone())
        return response
      })
      // Return cache immediately, update in background (stale-while-revalidate)
      return cached ?? fetchPromise
    })
  )
})
