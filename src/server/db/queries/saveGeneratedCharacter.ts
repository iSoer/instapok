import { eq } from "drizzle-orm"
import { db, generatedCharacterSchema } from "@db"
import { derivedOf } from "@/server/character-model/generate"
import { classById } from "@shared/character/classes"
import type { GeneratedCharacterType, SavedGeneratedCharacterType } from "@shared/api/schema/character/generated"
import { NameTakenError, isNameViolation } from "./saveGeneratedPokemon"

/** The divine class is already held by another character */
export class ClassTakenError extends Error {
  constructor(public classId: string) {
    super(`Class ${classId} is already held by another character`)
  }
}

type GeneratedCharacterRow = typeof generatedCharacterSchema.$inferSelect

export const rowToCharacter = (row: GeneratedCharacterRow): SavedGeneratedCharacterType => {
  const stored = {
    id: row.id,
    name: row.name,
    rarity: row.rarity,
    aptitudes: row.aptitudes,
    heightDm: row.heightDm,
    weightHg: row.weightHg,
    baseExperience: row.baseExperience,
    baseStats: row.baseStats,
    maxStats: row.maxStats,
    level: row.level,
    class: row.class,
    archetype: row.archetype,
    seed: row.seed,
    modelVersion: row.modelVersion,
    input: row.request
  }

  return { ...stored, ...derivedOf(stored) }
}

const DIVINE_CONSTRAINT = "generated_character_divine_class_unique"

const isDivineViolation = (error: unknown): boolean => {
  for (let current = error; current instanceof Error; current = current.cause) {
    if ((current as Error & { constraint?: string }).constraint === DIVINE_CONSTRAINT) {
      return true
    }
  }

  return false
}

/** Name and divine class conflicts as typed errors; the unique indexes decide, so concurrent saves are safe too */
const conflicts = async <T>(character: Pick<GeneratedCharacterType, "name" | "class">, run: () => Promise<T>) => {
  try {
    return await run()
  }
  catch (error) {
    if (isNameViolation(error)) {
      throw new NameTakenError([character.name])
    }

    if (isDivineViolation(error)) {
      throw new ClassTakenError(character.class)
    }

    throw error
  }
}

const tierOf = (classId: string) => classById(classId)!.tier

/** Saves one character */
export const saveGeneratedCharacter = (character: GeneratedCharacterType) => conflicts(character, async () => {
  // explain is not stored, stats and ranks are derived
  const { explain, input, stats, ranks, ...item } = character
  void explain
  void stats
  void ranks

  const [row] = await db.insert(generatedCharacterSchema).values({
    ...item,
    classTier: tierOf(item.class),
    request: input
  }).returning()

  return rowToCharacter(row)
})

/** Stores a new level and class of a saved character */
export const updateGeneratedCharacter = (character: SavedGeneratedCharacterType) => conflicts(character, async () => {
  const [row] = await db
    .update(generatedCharacterSchema)
    .set({ level: character.level, class: character.class, classTier: tierOf(character.class) })
    .where(eq(generatedCharacterSchema.id, character.id))
    .returning()

  return row ? rowToCharacter(row) : undefined
})

export const deleteGeneratedCharacter = async (id: string) => {
  const rows = await db
    .delete(generatedCharacterSchema)
    .where(eq(generatedCharacterSchema.id, id))
    .returning({ id: generatedCharacterSchema.id })

  return rows.length > 0
}
