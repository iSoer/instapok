import { relations } from "drizzle-orm"
import { pokemonsSchema, pokemonsTagsSchema, tagsSchema } from "../schema"

export const tagsRelations = relations(tagsSchema, ({ many }) => ({
  pokemons: many(pokemonsTagsSchema)
}))

export const pokemonsRelations = relations(pokemonsSchema, ({ many }) => ({
  tags: many(pokemonsTagsSchema)
}))

export const pokemonsTagsRelations = relations(pokemonsTagsSchema, ({ one }) => ({
  pokemon: one(pokemonsSchema, {
    fields: [pokemonsTagsSchema.pokemonId],
    references: [pokemonsSchema.id]
  }),
  tag: one(tagsSchema, {
    fields: [pokemonsTagsSchema.tagId],
    references: [tagsSchema.id]
  })
}))
