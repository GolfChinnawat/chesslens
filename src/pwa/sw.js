/* global assets, version */
const scope = new URL(self.registration.scope)
const prefix = 'chesslens-offline:' + scope.pathname + ':'
const cacheName = prefix + version
const files = new Set(assets.map((path) => new URL(path, scope).href))
const home = new URL('index.html', scope).href

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(cacheName)
      .then((cache) =>
        cache.addAll(
          [...files].map((url) => new Request(url, { cache: 'reload' })),
        ),
      ),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith(prefix) && key !== cacheName)
          await caches.delete(key)
      }
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== scope.origin) return

  const appNavigation =
    request.mode === 'navigate' &&
    (url.pathname === scope.pathname ||
      url.pathname === new URL(home).pathname) &&
    [...url.searchParams.keys()].every((key) => key === 'view')

  if (appNavigation) {
    event.respondWith(
      fetch(request).catch(
        async () =>
          (await (await caches.open(cacheName)).match(home)) ??
          Response.error(),
      ),
    )
  } else if (files.has(url.href)) {
    event.respondWith(
      (async () =>
        (await (await caches.open(cacheName)).match(request)) ??
        fetch(request))(),
    )
  }
})
