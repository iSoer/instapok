import { relations } from "drizzle-orm"
import { generatedPokemonSchema } from "../schema"

export const generatedPokemonRelations = relations(generatedPokemonSchema, ({ one, many }) => ({
  // Previous evolution stage, or the base pokemon of a form
  parent: one(generatedPokemonSchema, {
    fields: [generatedPokemonSchema.parentId],
    references: [generatedPokemonSchema.id],
    relationName: "generated_pokemon_parent"
  }),
  children: many(generatedPokemonSchema, {
    relationName: "generated_pokemon_parent"
  })
}))
