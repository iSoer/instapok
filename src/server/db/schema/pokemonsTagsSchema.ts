import { pgTable, uuid, primaryKey } from "drizzle-orm/pg-core"
import { pokemonsSchema, tagsSchema } from "./"

export const pokemonsTagsSchema = pgTable("pokemons_tags", {
  pokemonId: uuid("pokemon_id")
    .references(() => pokemonsSchema.id, { onDelete: "cascade" })
    .notNull(),
  tagId: uuid("tag_id")
    .references(() => tagsSchema.id, { onDelete: "cascade" })
    .notNull()
}, table => ({
  pk: primaryKey({ columns: [table.pokemonId, table.tagId] })
}))
