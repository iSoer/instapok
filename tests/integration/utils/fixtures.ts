import { sql } from "drizzle-orm"
import { db, pokemonsSchema, pokemonsTagsSchema, tagsSchema } from "@db"
import { assertTestDatabase } from "./testDatabase"

export type FixturePokemon = {
  name: string
  tags?: string[]
}

export type Fixture = {
  tags: string[]
  pokemons: FixturePokemon[]
}

export const resetDatabase = async () => {
  assertTestDatabase(process.env.DATABASE_URL)

  await db.execute(sql`TRUNCATE TABLE pokemons_tags, pokemons, tags RESTART IDENTITY CASCADE`)
}

/**
 * Truncates the test database and inserts the fixture.
 * Pokemons are inserted one by one so `created_at` follows array order, like the real seed script.
 */
export const seed = async ({ tags, pokemons }: Fixture) => {
  await resetDatabase()

  const tagIds: Record<string, string> = {}
  const pokemonIds: Record<string, string> = {}

  for (const name of tags) {
    const [{ id }] = await db.insert(tagsSchema).values({ name }).returning()
    tagIds[name] = id
  }

  for (const pokemon of pokemons) {
    const [{ id }] = await db.insert(pokemonsSchema).values({
      name: pokemon.name,
      width: 96,
      height: 96,
      alt: pokemon.name
    }).returning()

    pokemonIds[pokemon.name] = id

    const links = (pokemon.tags ?? []).map(tag => ({ pokemonId: id, tagId: tagIds[tag] }))

    if (links.length > 0) {
      await db.insert(pokemonsTagsSchema).values(links)
    }
  }

  return { tagIds, pokemonIds }
}
