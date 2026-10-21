import { eq, inArray } from "drizzle-orm"
import { db, generatedPokemonSchema, pokemonInfoSchema } from "@db"
import { INFO_SOURCES } from "@/server/pokemon-info/sources"
import type { GeneratedPokemonType, SavedGeneratedPokemonType } from "@shared/api/schema/pokemon/generated"

/** A name is already used by a generated or a downloaded pokemon */
export class NameTakenError extends Error {
  constructor(public names: string[]) {
    super(`Pokemon name already taken: ${names.join(", ")}`)
  }
}

type GeneratedRow = typeof generatedPokemonSchema.$inferSelect

export const rowToGenerated = (row: GeneratedRow): SavedGeneratedPokemonType => ({
  id: row.id,
  parentId: row.parentId,
  name: row.name,
  types: row.types as SavedGeneratedPokemonType["types"],
  abilities: row.abilities,
  heightDm: row.heightDm,
  weightHg: row.weightHg,
  baseExperience: row.baseExperience,
  stats: row.stats,
  class: row.class,
  stage: row.stageIndex !== null && row.stageOf !== null ? { index: row.stageIndex, of: row.stageOf } : null,
  archetype: row.archetype,
  form: row.form ?? null,
  seed: row.seed,
  modelVersion: row.modelVersion,
  input: row.request
})

const UNIQUE_VIOLATION = "23505"

// Drizzle wraps driver errors (DrizzleQueryError), the pg error with its code is somewhere in the cause chain
const isNameViolation = (error: unknown): boolean => {
  for (let current = error; current instanceof Error; current = current.cause) {
    const { code, constraint } = current as Error & { code?: string, constraint?: string }

    if (code === UNIQUE_VIOLATION && constraint?.endsWith("_name_unique")) {
      return true
    }
  }

  return false
}

/**
 * Saves pokemon in one transaction. Each item's parent is the previous item (an evolution line);
 * the first one gets `parentId` (e.g. the base of a mega form).
 */
export const saveGeneratedPokemon = async (
  items: GeneratedPokemonType[],
  { parentId = null }: { parentId?: string | null } = {}
) => {
  const names = items.map(item => item.name)

  try {
    return await db.transaction(async (tx) => {
      const [generated, downloaded] = await Promise.all([
        tx
          .select({ name: generatedPokemonSchema.name })
          .from(generatedPokemonSchema)
          .where(inArray(generatedPokemonSchema.name, names)),
        tx.select({ name: pokemonInfoSchema.name }).from(pokemonInfoSchema).where(inArray(pokemonInfoSchema.name, names))
      ])
      const taken = [...new Set([...generated, ...downloaded].map(row => row.name))]
      const duplicates = names.filter((name, i) => names.indexOf(name) !== i)

      if (taken.length > 0 || duplicates.length > 0) {
        throw new NameTakenError([...new Set([...taken, ...duplicates])])
      }

      const saved: SavedGeneratedPokemonType[] = []
      // One timestamp per item, so created_at keeps the line order inside the transaction
      const now = Date.now()
      let parent = parentId

      for (const [i, pokemon] of items.entries()) {
        // explain is not stored
        const { explain, input, stage, ...item } = pokemon
        void explain

        const [row] = await tx.insert(generatedPokemonSchema).values({
          ...item,
          abilitySourceId: INFO_SOURCES.pokeapi,
          stageIndex: stage?.index ?? null,
          stageOf: stage?.of ?? null,
          parentId: parent,
          request: input,
          createdAt: new Date(now + i)
        }).returning()

        saved.push(rowToGenerated(row))
        parent = row.id
      }

      return saved
    })
  }
  catch (error) {
    // Two concurrent saves of the same name: the unique index wins over the check above
    if (isNameViolation(error)) {
      throw new NameTakenError(names)
    }

    throw error
  }
}

export const deleteGeneratedPokemon = async (id: string) => {
  const rows = await db
    .delete(generatedPokemonSchema)
    .where(eq(generatedPokemonSchema.id, id))
    .returning({ id: generatedPokemonSchema.id })

  return rows.length > 0
}
