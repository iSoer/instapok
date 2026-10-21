import { asc } from "drizzle-orm"
import { abilitySchema, db } from "@db"

/**
 * Every downloaded ability. `name` is the key pokemon_info.abilities links by:
 * a pokemon's abilities are the rows with its sourceId whose name is in info.abilities.
 */
export const listAbilities = () => db
  .select({
    name: abilitySchema.name,
    sourceId: abilitySchema.sourceId,
    externalId: abilitySchema.externalId,
    displayName: abilitySchema.displayName,
    effect: abilitySchema.effect,
    shortEffect: abilitySchema.shortEffect,
    flavorText: abilitySchema.flavorText,
    generation: abilitySchema.generation,
    isMainSeries: abilitySchema.isMainSeries
  })
  .from(abilitySchema)
  .orderBy(asc(abilitySchema.sourceId), asc(abilitySchema.name))
