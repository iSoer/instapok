import { execFileSync } from "node:child_process"
import { Client } from "pg"
import { assertTestDatabase, getDatabaseName, getTestDatabaseUrl } from "./utils/testDatabase"

export default async function setup() {
  const url = getTestDatabaseUrl()
  assertTestDatabase(url)

  const name = getDatabaseName(url)
  const adminUrl = new URL(url)
  adminUrl.pathname = "/postgres"

  const client = new Client({ connectionString: adminUrl.toString() })

  try {
    await client.connect()
  }
  catch (error) {
    throw new Error(
      `Postgres is not reachable at ${adminUrl.host} (run \`docker compose up -d\`): ${(error as Error).message}`
    )
  }

  try {
    const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name])

    if (!rowCount) {
      // template0: always clean, and immune to collation-version drift of template1 in old docker volumes
      await client.query(`CREATE DATABASE "${name}" TEMPLATE template0`)
    }
  }
  finally {
    await client.end()
  }

  // dotenv does not override variables that are already set, so drizzle.config.ts picks up the test URL
  execFileSync("npx", ["drizzle-kit", "push", "--force"], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe"
  })
}
