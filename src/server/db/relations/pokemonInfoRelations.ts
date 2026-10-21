import { relations } from "drizzle-orm"
import { pokemonInfoSchema, pokemonSchema } from "../schema"

// Abilities are not a relation: pokemon_info.abilities holds ability.name values (see docs/abilities.md)
export const pokemonInfoRelations = relations(pokemonInfoSchema, ({ many }) => ({
  // Every sprite of the pokemon: regular, shiny and alternative forms
  sprites: many(pokemonSchema)
}))
