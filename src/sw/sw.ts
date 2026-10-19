/// <reference lib="esnext" />
/// <reference lib="webworker" />
import type { PrecacheEntry, RouteMatchCallbackOptions, SerwistGlobalConfig, SerwistPlugin } from "serwist"
import { CacheFirst, CacheableResponsePlugin, ExpirationPlugin, NetworkFirst, Serwist } from "serwist"

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

// Instapoke service worker. Bundled and served by src/app/serwist/[path]/route.ts, registered in production only.
// The precache manifest (hashed /_next/static chunks + additionalPrecacheEntries) is injected into self.__SW_MANIFEST.

const PAGES_CACHE = "pages"
const IMAGES_CACHE = "images"

// The app has a single page: every navigation is stored and looked up under "/"
const PAGE_KEY = "/"

// ~2950 sprites exist; keep only the most recently cached ones
const MAX_IMAGES = 500
const NAVIGATION_TIMEOUT_SECONDS = 4

// Caches of the hand-written worker this one replaces: pages-<version>, static-<version>, images-<version>
const LEGACY_CACHE = /^(pages|static|images)-/

// Non-GET, cross-origin and /api/* requests match no route, so Serwist does not touch them
function isCacheableRequest({ request, url, sameOrigin }: RouteMatchCallbackOptions): boolean {
  return sameOrigin && request.method === "GET" && !url.pathname.startsWith("/api/")
}

function isPageNavigation(options: RouteMatchCallbackOptions): boolean {
  return isCacheableRequest(options) && options.request.mode === "navigate"
}

function isImageRequest(options: RouteMatchCallbackOptions): boolean {
  const { pathname } = options.url

  return isCacheableRequest(options)
    && (pathname.startsWith("/uploads/") || pathname.startsWith("/assets/") || pathname.startsWith("/icons/"))
}

const singlePagePlugin: SerwistPlugin = {
  // Query strings like ?utm=… must not create extra entries
  cacheKeyWillBeUsed: async () => new URL(PAGE_KEY, self.location.origin).href,
  // Browsers reject a redirected response served to a navigation, so such responses are never stored
  cacheWillUpdate: async ({ request, response }) =>
    new URL(request.url).pathname === PAGE_KEY && !response.redirected ? response : null
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: {
    cleanupOutdatedCaches: true
  },
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  disableDevLogs: true,
  runtimeCaching: [
    {
      matcher: isPageNavigation,
      handler: new NetworkFirst({
        cacheName: PAGES_CACHE,
        networkTimeoutSeconds: NAVIGATION_TIMEOUT_SECONDS,
        plugins: [new CacheableResponsePlugin({ statuses: [200] }), singlePagePlugin]
      })
    },
    {
      matcher: isImageRequest,
      handler: new CacheFirst({
        cacheName: IMAGES_CACHE,
        plugins: [
          new CacheableResponsePlugin({ statuses: [200] }),
          new ExpirationPlugin({ maxEntries: MAX_IMAGES, purgeOnQuotaError: true })
        ]
      })
    }
  ]
})

// "/" is warmed here rather than precached: the precache route runs before runtimeCaching,
// so a precached "/" would be served cache-first and bypass the network-first navigation rule above
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PAGES_CACHE).then(cache => cache.add(PAGE_KEY)))
})

async function deleteLegacyCaches(): Promise<void> {
  const keys = await caches.keys()

  await Promise.all(keys.filter(key => LEGACY_CACHE.test(key)).map(key => caches.delete(key)))
}

self.addEventListener("activate", (event) => {
  event.waitUntil(deleteLegacyCaches())
})

serwist.addEventListeners()
