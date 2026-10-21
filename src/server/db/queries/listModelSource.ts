import { asc, eq } from "drizzle-orm"
import { abilitySchema, db, pokemonInfoSchema } from "@db"
import type { InfoSourceId } from "@/server/pokemon-info/sources"

/** Rows the pokemon model is fitted from (src/server/pokemon-model/fit.ts), ordered by number */
export const listPokemonInfoRows = (sourceId: InfoSourceId) => db
  .select({
    externalId: pokemonInfoSchema.externalId,
    name: pokemonInfoSchema.name,
    types: pokemonInfoSchema.types,
    abilities: pokemonInfoSchema.abilities,
    heightDm: pokemonInfoSchema.heightDm,
    weightHg: pokemonInfoSchema.weightHg,
    baseExperience: pokemonInfoSchema.baseExperience,
    stats: pokemonInfoSchema.stats
  })
  .from(pokemonInfoSchema)
  .where(eq(pokemonInfoSchema.sourceId, sourceId))
  .orderBy(asc(pokemonInfoSchema.externalId))

export const listAbilityNamesOfSource = async (sourceId: InfoSourceId) => {
  const rows = await db
    .select({ name: abilitySchema.name })
    .from(abilitySchema)
    .where(eq(abilitySchema.sourceId, sourceId))
    .orderBy(asc(abilitySchema.name))

  return rows.map(row => row.name)
}
