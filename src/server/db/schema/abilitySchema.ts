import { pgTable, uuid, text, timestamp, integer, boolean, unique } from "drizzle-orm/pg-core"

// Ability reference downloaded from an external service (src/server/pokemon-info); pokemon_info.abilities holds its name
export const abilitySchema = pgTable("ability", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Service the row was downloaded from, see INFO_SOURCES in src/server/pokemon-info/sources.ts
  sourceId: integer("source_id").notNull(),
  // Ability id in that service
  externalId: integer("external_id").notNull(),
  // Slug used by the service: "lightning-rod"; the key pokemon_info.abilities links by
  name: text("name").notNull(),
  // English texts; null when the service has none (e.g. non main series abilities)
  displayName: text("display_name"),
  effect: text("effect"),
  shortEffect: text("short_effect"),
  flavorText: text("flavor_text"),
  generation: text("generation").notNull(),
  isMainSeries: boolean("is_main_series").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow()
}, table => [
  unique("ability_source_external_unique").on(table.sourceId, table.externalId),
  unique("ability_source_name_unique").on(table.sourceId, table.name)
])
