import { asc, countDistinct, eq, inArray } from "drizzle-orm"
import { db, pokemonSchema, pokemonTagsSchema } from "@db"

export type ListPokemonParams = {
  page: number
  limit: number
  tags: string[]
}

/**
 * Ids of pokemon linked to every given tag (AND semantics):
 * only requested tags are counted, so extra tags on a pokemon don't matter.
 */
const pokemonIdsWithAllTags = (tagIds: string[]) => db
  .select({ id: pokemonTagsSchema.pokemonId })
  .from(pokemonTagsSchema)
  .where(inArray(pokemonTagsSchema.tagId, tagIds))
  .groupBy(pokemonTagsSchema.pokemonId)
  .having(eq(countDistinct(pokemonTagsSchema.tagId), tagIds.length))

export const listPokemon = async ({ page, limit, tags }: ListPokemonParams) => {
  const tagIds = [...new Set(tags)]

  // No tags means no filter; an empty IN () list must never reach the query
  const where = tagIds.length > 0
    ? inArray(pokemonSchema.id, pokemonIdsWithAllTags(tagIds))
    : undefined

  const [rows, total] = await Promise.all([
    db.query.pokemonSchema.findMany({
      columns: {
        id: true,
        name: true,
        width: true,
        height: true,
        alt: true
      },
      where,
      // created_at follows seed order; id breaks ties so pages never overlap
      orderBy: [asc(pokemonSchema.createdAt), asc(pokemonSchema.id)],
      limit,
      offset: page * limit,
      with: {
        tags: {
          columns: {},
          with: {
            tag: true
          }
        }
      }
    }),
    db.$count(pokemonSchema, where)
  ])

  return {
    data: rows.map(pokemon => ({
      ...pokemon,
      tags: pokemon.tags.map(({ tag }) => tag)
    })),
    total
  }
}
