import { beforeEach, describe, expect, it } from "vitest"
import { asc, eq } from "drizzle-orm"
import { db, pokemonInfoSchema, pokemonSchema } from "@db"
import { linkPokemonInfo, listPokemonNumbers, savePokemonInfo } from "@/server/db/queries/savePokemonInfo"
import { createPokemonInfoQueue } from "@/server/pokemon-info/pokemonInfoQueue"
import { INFO_SOURCES, type PokemonInfo } from "@/server/pokemon-info/sources"
import { seed } from "./utils/fixtures"

const info = (id: number, name = `pokemon-${id}`): PokemonInfo => ({
  sourceId: INFO_SOURCES.pokeapi,
  externalId: id,
  name,
  types: ["electric", "flying"],
  abilities: ["static"],
  heightDm: 4,
  weightHg: 60,
  baseExperience: null,
  stats: { hp: 1, attack: 2, defense: 3, specialAttack: 4, specialDefense: 5, speed: 6 }
})

const sprites = () => db.query.pokemonSchema.findMany({
  columns: { alt: true },
  with: { info: { columns: { name: true } } },
  orderBy: [asc(pokemonSchema.createdAt)]
})

const infoRows = () => db.select().from(pokemonInfoSchema).orderBy(asc(pokemonInfoSchema.externalId))

beforeEach(async () => {
  // seed() uses the name as alt
  await seed({ tags: [], pokemon: [{ name: "25" }, { name: "201-a" }, { name: "201-b" }, { name: "2" }, { name: "x" }] })
})

describe("savePokemonInfo", () => {
  it("stores one info row and links every sprite with that number to it", async () => {
    expect(await savePokemonInfo(info(201))).toBe(2)

    const [pikachu, a, b] = await sprites()

    expect(pikachu.info).toBeNull()
    expect([a.info?.name, b.info?.name]).toEqual(["pokemon-201", "pokemon-201"])
    expect(await infoRows()).toHaveLength(1)
  })

  it("writes nothing when no sprite has that number", async () => {
    expect(await savePokemonInfo(info(20))).toBe(0)
    expect(await infoRows()).toEqual([])
  })

  it("stores the source id, arrays and stats", async () => {
    await savePokemonInfo(info(25))

    const [row] = await infoRows()

    expect(row).toMatchObject({ ...info(25), sourceId: 0 })
    expect(row.fetchedAt).toBeInstanceOf(Date)
  })

  it("updates the existing row on a repeated download instead of adding one", async () => {
    await savePokemonInfo(info(25, "old"))
    const [{ id }] = await infoRows()

    await savePokemonInfo(info(25, "new"))

    expect(await infoRows()).toMatchObject([{ id, name: "new" }])
  })
})

describe("linkPokemonInfo", () => {
  it("relinks reseeded sprites to info downloaded before", async () => {
    await savePokemonInfo(info(201))
    await db.update(pokemonSchema).set({ infoId: null })

    expect(await linkPokemonInfo(INFO_SOURCES.pokeapi)).toBe(2)

    const linked = await db.select().from(pokemonSchema).where(eq(pokemonSchema.alt, "201-b"))

    expect(linked[0].infoId).not.toBeNull()
  })
})

describe("listPokemonNumbers", () => {
  it("returns distinct numeric numbers, optionally only those without info", async () => {
    expect(await listPokemonNumbers()).toEqual([2, 25, 201])

    await savePokemonInfo(info(25))

    expect(await listPokemonNumbers({ onlyMissing: true })).toEqual([2, 201])
  })
})

describe("createPokemonInfoQueue", () => {
  it("fetches each id and saves it; unknown rows fail without retries", async () => {
    const fetched: number[] = []

    const queue = createPokemonInfoQueue({
      retryDelayMs: 1,
      fetchInfo: async (id) => {
        fetched.push(id)

        return info(id)
      }
    })

    queue.push([25, 201, 999])

    const { succeeded, failed } = await queue.drain()

    expect(succeeded.sort((x, y) => x - y)).toEqual([25, 201])
    expect(failed.map(({ item }) => item)).toEqual([999])
    expect(fetched.filter(id => id === 999)).toHaveLength(1)
    expect((await sprites()).filter(sprite => sprite.info !== null)).toHaveLength(3)
  })
})
