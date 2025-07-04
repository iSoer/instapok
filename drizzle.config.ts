import "dotenv/config"
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  out: "./src/server/db/generated",
  schema: "./src/server/db/schema",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!
  }
})
