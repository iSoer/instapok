import { pgTable, uuid, varchar, text, timestamp, integer } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const pokemonsSchema = pgTable("pokemons", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  alt: text("alt"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
})
