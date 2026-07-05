// GrandEase Traveler service worker — offline app shell.
// Precaches core assets, then caches hashed build assets on first use
// (stale-while-revalidate). Navigations fall back to the cached app when
// offline. Cross-origin requests (Google sign-in / Maps / Calendar API) are
// never intercepted, so they always hit the network.

const CACHE = 'grandease-v1'
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './logo-cube.png',
  './splash.png',
  './icon-192.png',
  './apple-touch-icon.png',
  './favicon-32.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(CORE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // leave Google APIs/scripts alone

  // App navigations: try network, fall back to the cached shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match('./index.html').then((r) => r || caches.match('./')),
      ),
    )
    return
  }

  // Same-origin assets: serve from cache, refresh in the background.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        })
        .catch(() => cached)
      return cached || network
    }),
  )
})
