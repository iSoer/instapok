import { asc, countDistinct, eq, inArray } from "drizzle-orm"
import { db, pokemonsSchema, pokemonsTagsSchema } from "@db"

export type ListPokemonsParams = {
  page: number
  limit: number
  tags: string[]
}

/**
 * Ids of pokemons linked to every given tag (AND semantics):
 * only requested tags are counted, so extra tags on a pokemon don't matter.
 */
const pokemonIdsWithAllTags = (tagIds: string[]) => db
  .select({ id: pokemonsTagsSchema.pokemonId })
  .from(pokemonsTagsSchema)
  .where(inArray(pokemonsTagsSchema.tagId, tagIds))
  .groupBy(pokemonsTagsSchema.pokemonId)
  .having(eq(countDistinct(pokemonsTagsSchema.tagId), tagIds.length))

export const listPokemons = async ({ page, limit, tags }: ListPokemonsParams) => {
  const tagIds = [...new Set(tags)]

  // No tags means no filter; an empty IN () list must never reach the query
  const where = tagIds.length > 0
    ? inArray(pokemonsSchema.id, pokemonIdsWithAllTags(tagIds))
    : undefined

  const [rows, total] = await Promise.all([
    db.query.pokemonsSchema.findMany({
      columns: {
        id: true,
        name: true,
        width: true,
        height: true,
        alt: true
      },
      where,
      // created_at follows seed order; id breaks ties so pages never overlap
      orderBy: [asc(pokemonsSchema.createdAt), asc(pokemonsSchema.id)],
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
    db.$count(pokemonsSchema, where)
  ])

  return {
    data: rows.map(pokemon => ({
      ...pokemon,
      tags: pokemon.tags.map(({ tag }) => tag)
    })),
    total
  }
}
