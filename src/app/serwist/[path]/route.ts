import { randomUUID } from "node:crypto"
import { spawnSync } from "node:child_process"
import { createSerwistRoute } from "@serwist/turbopack"

// Bundles src/sw/sw.ts with esbuild and serves it as /serwist/sw.js (prerendered at build time, rebuilt on change in dev).
// The revision versions the extra precache entries below; the hashed /_next/static chunks carry their own hash.
function gitRevision(): string {
  const result = spawnSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })

  return result.status === 0 && result.stdout.trim() ? result.stdout.trim() : randomUUID()
}

const revision = gitRevision()

// "/" is not here on purpose: the worker warms it into the network-first "pages" cache (see src/sw/sw.ts)
const precachedUrls = ["/manifest.webmanifest", "/assets/pokeball.webp", "/icons/icon-192.png", "/icons/icon-512.png"]

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  swSrc: "src/sw/sw.ts",
  useNativeEsbuild: true,
  // Only the build output: the default "public/**/*" would precache ~2950 sprites from public/uploads
  globPatterns: [".next/static/**/*"],
  additionalPrecacheEntries: precachedUrls.map(url => ({ url, revision }))
})
