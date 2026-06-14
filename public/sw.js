// Offline service worker. The app is a single self-contained HTML file plus a few
// small sidecars (manifest, icon), so caching is simple. Strategy: network-first
// — online users always get the freshest build — falling back to the cached app
// shell when the network is unavailable, so an offline reload still works.
// Relative URLs (resolved against the SW's scope) keep it deploy-location-agnostic.

const CACHE = "iso20022-mig-editor-v1"
const SHELL = ["./", "./index.html", "./manifest.json", "./icon.svg"]

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  )
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Keep same-origin responses fresh in the cache for offline use.
        if (response.ok && new URL(request.url).origin === self.location.origin) {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy))
        }
        return response
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("./index.html"))),
  )
})
