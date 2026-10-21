import { and, arrayContains, asc, desc, eq } from "drizzle-orm"
import { db, generatedPokemonSchema } from "@db"
import type { PokemonClass, PokemonType } from "@shared/api/schema/pokemon/generated"
import { rowToGenerated } from "./saveGeneratedPokemon"

export type ListGeneratedParams = {
  page: number
  limit: number
  types: PokemonType[]
  class?: PokemonClass
  order?: "asc" | "desc"
}

/** Generated pokemon with every given type (AND semantics), oldest first unless `order` is desc */
export const listGeneratedPokemon = async ({ page, limit, types, class: pokemonClass, order = "asc" }: ListGeneratedParams) => {
  const direction = order === "asc" ? asc : desc
  const where = and(
    // No types means no filter; never an empty containment check
    types.length > 0 ? arrayContains(generatedPokemonSchema.types, types) : undefined,
    pokemonClass ? eq(generatedPokemonSchema.class, pokemonClass) : undefined
  )

  const [rows, total] = await Promise.all([
    db
      .select()
      .from(generatedPokemonSchema)
      .where(where)
      // created_at follows save order; id breaks ties so pages never overlap
      .orderBy(direction(generatedPokemonSchema.createdAt), direction(generatedPokemonSchema.id))
      .limit(limit)
      .offset(page * limit),
    db.$count(generatedPokemonSchema, where)
  ])

  return { data: rows.map(rowToGenerated), total }
}

export const getGeneratedPokemon = async (id: string) => {
  const [row] = await db.select().from(generatedPokemonSchema).where(eq(generatedPokemonSchema.id, id))

  return row ? rowToGenerated(row) : undefined
}
