"use client"
import { useEffect } from "react"

// A worker left over from `npm start` on the same origin would serve stale Turbopack chunks cache-first in dev
async function removeServiceWorker() {
  const registrations = await navigator.serviceWorker.getRegistrations()

  await Promise.all(registrations.map(registration => registration.unregister()))

  // The worker is the only Cache Storage user in this app
  const keys = await caches.keys()

  await Promise.all(keys.map(key => caches.delete(key)))
}

// Production only: in dev the cache-first rules would serve stale Turbopack chunks
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return
    }

    if (process.env.NODE_ENV !== "production") {
      removeServiceWorker().catch(error => console.error("Service worker removal failed", error))
      return
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(error => console.error("Service worker registration failed", error))
  }, [])

  return null
}
