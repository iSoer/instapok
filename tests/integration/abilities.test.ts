import { beforeEach, describe, expect, it } from "vitest"
import { asc } from "drizzle-orm"
import { abilitySchema, db } from "@db"
import { GET } from "@/app/api/pokemon/abilities/route"
import { listAbilityNames, saveAbility } from "@/server/db/queries/saveAbility"
import { savePokemonInfo } from "@/server/db/queries/savePokemonInfo"
import { createAbilityQueue } from "@/server/pokemon-info/abilityQueue"
import { INFO_SOURCES, type AbilityInfo, type PokemonInfo } from "@/server/pokemon-info/sources"
import { abilitiesResponseSchema } from "@shared/api/schema/pokemon/abilities"
import { seed } from "./utils/fixtures"

const pokemon = (id: number, abilities: string[]): PokemonInfo => ({
  sourceId: INFO_SOURCES.pokeapi,
  externalId: id,
  name: `pokemon-${id}`,
  types: ["normal"],
  abilities,
  heightDm: 1,
  weightHg: 1,
  baseExperience: null,
  stats: { hp: 1, attack: 1, defense: 1, specialAttack: 1, specialDefense: 1, speed: 1 }
})

const IDS: Record<string, number> = { "static": 9, "lightning-rod": 31, "chlorophyll": 34, "overgrow": 65 }

const ability = (name: string, displayName: string | null = name): AbilityInfo => ({
  sourceId: INFO_SOURCES.pokeapi,
  externalId: IDS[name],
  name,
  displayName,
  effect: `${name} effect`,
  shortEffect: null,
  flavorText: null,
  generation: "generation-iii",
  isMainSeries: true
})

const abilityRows = () => db.select().from(abilitySchema).orderBy(asc(abilitySchema.externalId))

beforeEach(async () => {
  // seed() uses the name as alt
  await seed({ tags: [], pokemon: [{ name: "1" }, { name: "25" }, { name: "26" }] })
  await savePokemonInfo(pokemon(1, ["overgrow", "chlorophyll"]))
  await savePokemonInfo(pokemon(25, ["static", "lightning-rod"]))
  await savePokemonInfo(pokemon(26, ["static", "lightning-rod"]))
})

describe("saveAbility", () => {
  it("stores the ability under its source id", async () => {
    await saveAbility(ability("static"))

    expect(await abilityRows()).toMatchObject([{ ...ability("static"), sourceId: 0 }])
  })

  it("updates the existing row on a repeated download", async () => {
    await saveAbility(ability("static", "Old"))
    await saveAbility(ability("static", "New"))

    expect(await abilityRows()).toMatchObject([{ externalId: 9, displayName: "New" }])
  })
})

describe("listAbilityNames", () => {
  it("returns distinct names from pokemon_info.abilities, optionally only the missing ones", async () => {
    expect(await listAbilityNames(INFO_SOURCES.pokeapi)).toEqual(["chlorophyll", "lightning-rod", "overgrow", "static"])

    await saveAbility(ability("static"))

    expect(await listAbilityNames(INFO_SOURCES.pokeapi, { onlyMissing: true }))
      .toEqual(["chlorophyll", "lightning-rod", "overgrow"])
  })
})

describe("createAbilityQueue", () => {
  it("fetches and saves each ability", async () => {
    const queue = createAbilityQueue({ retryDelayMs: 1, fetchInfo: async name => ability(name) })

    queue.push(["static", "overgrow"])

    const { succeeded, failed } = await queue.drain()

    expect(succeeded.sort()).toEqual(["overgrow", "static"])
    expect(failed).toEqual([])
    expect((await abilityRows()).map(row => row.name)).toEqual(["static", "overgrow"])
  })
})

describe("GET /api/pokemon/abilities", () => {
  it("returns every ability keyed by name, ordered by name", async () => {
    await saveAbility(ability("static"))
    await saveAbility(ability("overgrow"))

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(abilitiesResponseSchema.parse(body)).toEqual(body)
    expect(body.data).toEqual([
      expect.objectContaining({ name: "overgrow", externalId: 65 }),
      {
        name: "static",
        sourceId: 0,
        externalId: 9,
        displayName: "static",
        effect: "static effect",
        shortEffect: null,
        flavorText: null,
        generation: "generation-iii",
        isMainSeries: true
      }
    ])
  })

  it("resolves a pokemon's abilities by name", async () => {
    await Promise.all(Object.keys(IDS).map(name => saveAbility(ability(name))))

    const { data } = await (await GET()).json() as { data: { name: string, externalId: number }[] }
    const byName = new Map(data.map(item => [item.name, item.externalId]))
    const pikachu = await db.query.pokemonInfoSchema.findFirst({ where: (info, { eq }) => eq(info.externalId, 25) })

    expect(pikachu?.abilities.map(name => byName.get(name))).toEqual([9, 31])
  })

  it("returns an empty list when nothing is downloaded", async () => {
    expect(await (await GET()).json()).toEqual({ data: [] })
  })
})
