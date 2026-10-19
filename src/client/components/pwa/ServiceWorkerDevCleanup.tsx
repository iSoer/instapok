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

// Dev only. Registration in production is done by SerwistProvider, whose `disable` does not remove an installed worker
export function ServiceWorkerDevCleanup() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" || !("serviceWorker" in navigator)) {
      return
    }

    removeServiceWorker().catch(error => console.error("Service worker removal failed", error))
  }, [])

  return null
}
