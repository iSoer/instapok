import { defineConfig } from "vitest/config"

// Dedicated database for integration tests; never the dev database from .env
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/instapoke_test"

// Visible to globalSetup (main process) and inherited by workers
process.env.TEST_DATABASE_URL = TEST_DATABASE_URL

export default defineConfig({
  resolve: {
    tsconfigPaths: true
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.{ts,tsx}"],
          environment: "node"
        }
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          env: {
            DATABASE_URL: TEST_DATABASE_URL
          },
          globalSetup: ["tests/integration/globalSetup.ts"],
          setupFiles: ["tests/integration/setup.ts"],
          // All files share one database
          fileParallelism: false,
          hookTimeout: 60_000
        }
      }
    ]
  }
})
