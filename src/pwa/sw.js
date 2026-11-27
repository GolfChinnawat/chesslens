/* global assets, version, shell */
const scope = new URL(self.registration.scope)
const prefix = 'chesslens-offline:' + scope.pathname + ':'
const cacheName = prefix + version
const files = new Set(assets.map((path) => new URL(path, scope).href))
const home = new URL(shell, scope).href
const indexPath = new URL('index.html', scope).pathname
const routeKeys = new Set(['view', 'room', 'online'])

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
    (url.pathname === scope.pathname || url.pathname === indexPath) &&
    [...url.searchParams.keys()].every((key) => routeKeys.has(key))

  if (appNavigation) {
    event.respondWith(
      (async () =>
        (await (await caches.open(cacheName)).match(home)) ?? fetch(request))(),
    )
  } else if (files.has(url.href)) {
    event.respondWith(
      (async () =>
        (await (await caches.open(cacheName)).match(request)) ??
        fetch(request))(),
    )
  }
})
