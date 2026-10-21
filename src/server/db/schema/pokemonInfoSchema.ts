import { pgTable, uuid, text, timestamp, integer, jsonb, unique } from "drizzle-orm/pg-core"

export type PokemonStats = {
  hp: number
  attack: number
  defense: number
  specialAttack: number
  specialDefense: number
  speed: number
}

// Pokemon data downloaded from an external service (src/server/pokemon-info); sprite rows point here via pokemon.info_id
export const pokemonInfoSchema = pgTable("pokemon_info", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Service the row was downloaded from, see INFO_SOURCES in src/server/pokemon-info/sources.ts
  sourceId: integer("source_id").notNull(),
  // Pokemon number in that service
  externalId: integer("external_id").notNull(),
  name: text("name").notNull(),
  types: text("types").array().notNull(),
  // ability.name values of the same source, in slot order; no FK, arrays cannot have one
  abilities: text("abilities").array().notNull(),
  // PokeAPI units: decimetres and hectograms
  heightDm: integer("height_dm").notNull(),
  weightHg: integer("weight_hg").notNull(),
  baseExperience: integer("base_experience"),
  stats: jsonb("stats").$type<PokemonStats>().notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow()
}, table => [
  unique("pokemon_info_source_external_unique").on(table.sourceId, table.externalId)
])
