import { and, asc, desc, eq } from "drizzle-orm"
import { db, generatedCharacterSchema } from "@db"
import type { Rarity } from "@shared/character/leveling"
import { rowToCharacter } from "./saveGeneratedCharacter"

export type ListGeneratedCharactersParams = {
  page: number
  limit: number
  rarity?: Rarity
  class?: string
  order?: "asc" | "desc"
}

/** Generated characters of the rarity and class, oldest first unless `order` is desc */
export const listGeneratedCharacters = async ({
  page,
  limit,
  rarity,
  class: classId,
  order = "asc"
}: ListGeneratedCharactersParams) => {
  const direction = order === "asc" ? asc : desc
  const where = and(
    rarity ? eq(generatedCharacterSchema.rarity, rarity) : undefined,
    classId ? eq(generatedCharacterSchema.class, classId) : undefined
  )

  const [rows, total] = await Promise.all([
    db
      .select()
      .from(generatedCharacterSchema)
      .where(where)
      // id breaks ties so pages never overlap
      .orderBy(direction(generatedCharacterSchema.createdAt), direction(generatedCharacterSchema.id))
      .limit(limit)
      .offset(page * limit),
    db.$count(generatedCharacterSchema, where)
  ])

  return { data: rows.map(rowToCharacter), total }
}

export const getGeneratedCharacter = async (id: string) => {
  const [row] = await db.select().from(generatedCharacterSchema).where(eq(generatedCharacterSchema.id, id))

  return row ? rowToCharacter(row) : undefined
}
