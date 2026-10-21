import { pgTable, uuid, primaryKey } from "drizzle-orm/pg-core"
import { pokemonSchema, tagsSchema } from "./"

export const pokemonTagsSchema = pgTable("pokemon_tags", {
  pokemonId: uuid("pokemon_id")
    .references(() => pokemonSchema.id, { onDelete: "cascade" })
    .notNull(),
  tagId: uuid("tag_id")
    .references(() => tagsSchema.id, { onDelete: "cascade" })
    .notNull()
}, table => ({
  pk: primaryKey({ columns: [table.pokemonId, table.tagId] })
}))
