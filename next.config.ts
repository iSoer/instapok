import type { NextConfig } from "next"
import { withSerwist } from "@serwist/turbopack"

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // The browser must always revalidate the service worker script, otherwise updates get stuck.
        // Content-Type and Service-Worker-Allowed: / (the worker controls "/" from /serwist/) come from the route handler
        source: "/serwist/:path*",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" }
        ]
      }
    ]
  }
}

export default withSerwist(nextConfig)
