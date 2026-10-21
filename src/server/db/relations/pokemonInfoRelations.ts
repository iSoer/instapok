import { relations } from "drizzle-orm"
import { pokemonInfoSchema, pokemonSchema } from "../schema"

// Every sprite of the pokemon: regular, shiny and alternative forms
export const pokemonInfoRelations = relations(pokemonInfoSchema, ({ many }) => ({
  sprites: many(pokemonSchema)
}))
