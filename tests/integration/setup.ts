import { afterAll } from "vitest"
import { Pool } from "pg"
import { assertTestDatabase } from "./utils/testDatabase"

assertTestDatabase(process.env.DATABASE_URL)

afterAll(async () => {
  const { db } = await import("@db")

  // drizzle(url) creates a Pool; close it so the worker exits cleanly
  if (db.$client instanceof Pool) {
    await db.$client.end()
  }
})
