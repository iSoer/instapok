import { and, eq, isNull, sql } from "drizzle-orm"
import { db, pokemonInfoSchema, pokemonSchema } from "@db"
import type { InfoSourceId, PokemonInfo } from "@/server/pokemon-info/sources"

// `alt` is the sprite number: "25" for 25.webp and 25.shiny.webp, "201" for the 201-a.webp Unown forms
const altNumber = sql`split_part(${pokemonSchema.alt}, '-', 1)`

/**
 * Upserts the info by (source, number) and points every sprite row of that pokemon at it.
 * Returns how many sprite rows were linked; with 0 nothing is written.
 */
export const savePokemonInfo = async (info: PokemonInfo) => db.transaction(async (tx) => {
  const sameNumber = sql`${altNumber} = ${String(info.externalId)}`
  const sprites = await tx.select({ id: pokemonSchema.id }).from(pokemonSchema).where(sameNumber)

  if (sprites.length === 0) {
    return 0
  }

  const fetchedAt = new Date()

  const [{ id }] = await tx
    .insert(pokemonInfoSchema)
    .values({ ...info, fetchedAt })
    .onConflictDoUpdate({
      target: [pokemonInfoSchema.sourceId, pokemonInfoSchema.externalId],
      set: { ...info, fetchedAt }
    })
    .returning({ id: pokemonInfoSchema.id })

  const linked = await tx
    .update(pokemonSchema)
    .set({ infoId: id })
    .where(sameNumber)
    .returning({ id: pokemonSchema.id })

  return linked.length
})

/** Points sprite rows without info at already downloaded `pokemon_info` rows (used after reseeding). Returns linked count */
export const linkPokemonInfo = async (sourceId: InfoSourceId) => {
  const rows = await db
    .update(pokemonSchema)
    .set({ infoId: sql`${pokemonInfoSchema.id}` })
    .from(pokemonInfoSchema)
    .where(and(
      isNull(pokemonSchema.infoId),
      eq(pokemonInfoSchema.sourceId, sourceId),
      sql`${altNumber} = ${pokemonInfoSchema.externalId}::text`
    ))
    .returning({ id: pokemonSchema.id })

  return rows.length
}

/** Distinct pokemon numbers present in the table; `onlyMissing` skips the ones without linked info */
export const listPokemonNumbers = async ({ onlyMissing = false } = {}) => {
  const rows = await db
    .selectDistinct({ number: sql<number>`${altNumber}::int`.as("pokemon_number") })
    .from(pokemonSchema)
    .where(and(
      sql`${altNumber} ~ '^[0-9]+$'`,
      onlyMissing ? isNull(pokemonSchema.infoId) : undefined
    ))
    .orderBy(sql`pokemon_number`)

  return rows.map(({ number }) => number)
}
