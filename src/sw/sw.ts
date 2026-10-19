/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope
// Injected at bundle time by src/server/scripts/buildServiceWorker.ts, changes on every build
declare const __SW_VERSION__: string

// Instapoke service worker. Bundled to public/sw.js (scope "/"), registered in production only.
// Every build gets a new version, so activation drops the caches of the previous deploy.
const VERSION = __SW_VERSION__
const PAGES_CACHE = `pages-${VERSION}`
const STATIC_CACHE = `static-${VERSION}`
const IMAGES_CACHE = `images-${VERSION}`

// ~2950 sprites exist; keep only the most recently cached ones
const MAX_IMAGES = 500
// Safety net: the version bump already drops old chunks, this only bounds a single long-lived deploy
const MAX_STATIC = 300

const TRIM_DELAY_MS = 5000
const NAVIGATION_TIMEOUT_MS = 4000

// The app has a single page: every navigation is stored and looked up under "/"
const PAGE_KEY = "/"

const PRECACHE = [
  PAGE_KEY,
  "/manifest.webmanifest",
  "/assets/pokeball.webp",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
]

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Cache writes run in the background: a failure (e.g. QuotaExceededError) must never affect the response
function putQuietly(cache: Cache, key: RequestInfo, response: Response): Promise<void> {
  return cache.put(key, response).catch(() => {})
}

async function trimCache(cacheName: string, maxEntries: number): Promise<void> {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()

  // Cache.keys() follows insertion order, so the oldest entries go first
  await Promise.all(keys.slice(0, Math.max(0, keys.length - maxEntries)).map(key => cache.delete(key)))
}

const pendingTrims = new Map<string, Promise<void>>()

// Reading all keys is expensive: writes within TRIM_DELAY_MS share one trim per cache
function scheduleTrim(cacheName: string, maxEntries: number): Promise<void> {
  let pending = pendingTrims.get(cacheName)

  if (!pending) {
    pending = delay(TRIM_DELAY_MS)
      .then(() => trimCache(cacheName, maxEntries))
      .catch(() => {})
      .finally(() => pendingTrims.delete(cacheName))

    pendingTrims.set(cacheName, pending)
  }

  return pending
}

// Browsers reject a redirected response served to a navigation, so drop the redirect flag
function withoutRedirect(response: Response): Response {
  return response.redirected ? new Response(response.body, response) : response
}

async function matchPage(cache: Cache): Promise<Response | undefined> {
  const cached = await cache.match(PAGE_KEY)

  return cached && withoutRedirect(cached)
}

async function fetchPage(event: FetchEvent): Promise<Response> {
  const preloaded: unknown = await event.preloadResponse

  return preloaded instanceof Response ? preloaded : fetch(event.request)
}

async function networkFirstPage(event: FetchEvent): Promise<Response> {
  const network = fetchPage(event)
  const isPage = new URL(event.request.url).pathname === PAGE_KEY
  const cache = await caches.open(PAGES_CACHE)

  // Registered before the race below, so the clone happens before the page starts reading the body
  event.waitUntil(network.then(response => isPage && response.ok
    ? putQuietly(cache, PAGE_KEY, response.clone())
    : undefined).catch(() => {}))

  const cached = await matchPage(cache)

  if (!cached) {
    return network
  }

  // A slow network falls back to the cached copy; the request above still refreshes the cache
  return Promise.race([network, delay(NAVIGATION_TIMEOUT_MS).then(() => cached)]).catch(() => cached)
}

async function cacheFirst(event: FetchEvent, cacheName: string, maxEntries: number): Promise<Response> {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(event.request)

  if (cached) {
    return cached
  }

  const response = await fetch(event.request)

  if (response.ok) {
    event.waitUntil(putQuietly(cache, event.request, response.clone()).then(() => scheduleTrim(cacheName, maxEntries)))
  }

  return response
}

self.addEventListener("install", (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(PAGES_CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  )
})

async function activate(): Promise<void> {
  const current = [PAGES_CACHE, STATIC_CACHE, IMAGES_CACHE]
  const keys = await caches.keys()

  await Promise.all(keys.filter(key => !current.includes(key)).map(key => caches.delete(key)))
  await self.registration.navigationPreload?.enable()
  await self.clients.claim()
}

self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(activate())
})

function isImagePath(pathname: string): boolean {
  return pathname.startsWith("/uploads/") || pathname.startsWith("/assets/") || pathname.startsWith("/icons/")
}

self.addEventListener("fetch", (event: FetchEvent) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return
  }

  // API responses depend on filters and pagination: always go to the network
  if (url.pathname.startsWith("/api/")) {
    return
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(event))
    return
  }

  // Hashed build output is immutable
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(event, STATIC_CACHE, MAX_STATIC))
    return
  }

  if (isImagePath(url.pathname)) {
    event.respondWith(cacheFirst(event, IMAGES_CACHE, MAX_IMAGES))
  }
})

// Module scope, so `declare const self` above shadows the global one
export {}
