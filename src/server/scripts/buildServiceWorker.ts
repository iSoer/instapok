import path from "path"
import { execFileSync } from "node:child_process"
import { build } from "esbuild"

// Bundles src/sw/sw.ts into public/sw.js (a build artifact, gitignored). Runs as `prebuild`, or: npm run sw:build
// The real Next build id does not exist before `next build`, so the cache version is the git revision plus a build time:
// every build activates a new worker, which drops the caches of the previous one.

function gitRevision(): string {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim()
  }
  catch {
    return "nogit"
  }
}

(async () => {
  const version = `${gitRevision()}-${Date.now().toString(36)}`

  await build({
    entryPoints: [path.resolve("./src/sw/sw.ts")],
    outfile: path.resolve("./public/sw.js"),
    bundle: true,
    minify: true,
    format: "iife",
    target: "es2020",
    define: { __SW_VERSION__: JSON.stringify(version) },
    logLevel: "info"
  })

  console.log(`Service worker version: ${version}`)
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
