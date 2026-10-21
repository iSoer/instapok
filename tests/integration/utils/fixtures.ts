import { sql } from "drizzle-orm"
import { db, pokemonSchema, pokemonTagsSchema, tagsSchema } from "@db"
import { assertTestDatabase } from "./testDatabase"

export type FixturePokemon = {
  name: string
  tags?: string[]
}

export type Fixture = {
  tags: string[]
  pokemon: FixturePokemon[]
}

export const resetDatabase = async () => {
  assertTestDatabase(process.env.DATABASE_URL)

  await db.execute(sql`
    TRUNCATE TABLE pokemon_tags, pokemon, ability, pokemon_info, tags, generated_pokemon RESTART IDENTITY CASCADE
  `)
}

/**
 * Truncates the test database and inserts the fixture.
 * Pokemon are inserted one by one so `created_at` follows array order, like the real seed script.
 */
export const seed = async ({ tags, pokemon }: Fixture) => {
  await resetDatabase()

  const tagIds: Record<string, string> = {}
  const pokemonIds: Record<string, string> = {}

  for (const name of tags) {
    const [{ id }] = await db.insert(tagsSchema).values({ name }).returning()
    tagIds[name] = id
  }

  for (const fixture of pokemon) {
    const [{ id }] = await db.insert(pokemonSchema).values({
      name: fixture.name,
      width: 96,
      height: 96,
      alt: fixture.name
    }).returning()

    pokemonIds[fixture.name] = id

    const links = (fixture.tags ?? []).map(tag => ({ pokemonId: id, tagId: tagIds[tag] }))

    if (links.length > 0) {
      await db.insert(pokemonTagsSchema).values(links)
    }
  }

  return { tagIds, pokemonIds }
}
