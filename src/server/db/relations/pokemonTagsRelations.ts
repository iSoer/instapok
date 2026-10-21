import { relations } from "drizzle-orm"
import { pokemonInfoSchema, pokemonSchema, pokemonTagsSchema, tagsSchema } from "../schema"

export const tagsRelations = relations(tagsSchema, ({ many }) => ({
  pokemon: many(pokemonTagsSchema)
}))

export const pokemonRelations = relations(pokemonSchema, ({ one, many }) => ({
  tags: many(pokemonTagsSchema),
  info: one(pokemonInfoSchema, {
    fields: [pokemonSchema.infoId],
    references: [pokemonInfoSchema.id]
  })
}))

export const pokemonTagsRelations = relations(pokemonTagsSchema, ({ one }) => ({
  pokemon: one(pokemonSchema, {
    fields: [pokemonTagsSchema.pokemonId],
    references: [pokemonSchema.id]
  }),
  tag: one(tagsSchema, {
    fields: [pokemonTagsSchema.tagId],
    references: [tagsSchema.id]
  })
}))
