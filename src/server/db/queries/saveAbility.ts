import { and, eq, notExists, sql } from "drizzle-orm"
import { abilitySchema, db, pokemonInfoSchema } from "@db"
import type { AbilityInfo, InfoSourceId } from "@/server/pokemon-info/sources"

/** Upserts the ability by (source, external id) */
export const saveAbility = async (info: AbilityInfo) => {
  const fetchedAt = new Date()

  await db
    .insert(abilitySchema)
    .values({ ...info, fetchedAt })
    .onConflictDoUpdate({
      target: [abilitySchema.sourceId, abilitySchema.externalId],
      set: { ...info, fetchedAt }
    })
}

/** Ability names listed in pokemon_info.abilities of that source; `onlyMissing` skips the ones already in `ability` */
export const listAbilityNames = async (sourceId: InfoSourceId, { onlyMissing = false } = {}) => {
  const name = sql<string>`unnest(${pokemonInfoSchema.abilities})`.as("ability_name")

  const names = db
    .selectDistinct({ name })
    .from(pokemonInfoSchema)
    .where(eq(pokemonInfoSchema.sourceId, sourceId))
    .as("names")

  const rows = await db
    .select({ name: names.name })
    .from(names)
    .where(onlyMissing
      ? notExists(db
          .select({ id: abilitySchema.id })
          .from(abilitySchema)
          .where(and(eq(abilitySchema.sourceId, sourceId), eq(abilitySchema.name, names.name))))
      : undefined)
    .orderBy(names.name)

  return rows.map(row => row.name)
}
