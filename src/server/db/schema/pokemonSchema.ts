import { pgTable, uuid, varchar, text, timestamp, integer } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { pokemonInfoSchema } from "./pokemonInfoSchema"

export const pokemonSchema = pgTable("pokemon", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  // Sprite size in pixels
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  alt: text("alt"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  // Null until the pokemon info queue has downloaded this sprite's pokemon
  infoId: uuid("info_id").references(() => pokemonInfoSchema.id, { onDelete: "set null" })
})
