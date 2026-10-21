import { beforeEach, describe, expect, it } from "vitest"
import { NextRequest } from "next/server"
import { asc } from "drizzle-orm"
import { db, generatedPokemonSchema, pokemonInfoSchema } from "@db"
import { GET as LIST, POST as SAVE } from "@/app/api/pokemon/generated/route"
import { POST as PREVIEW } from "@/app/api/pokemon/generated/preview/route"
import { DELETE, GET as GET_ONE } from "@/app/api/pokemon/generated/[id]/route"
import { INFO_SOURCES } from "@/server/pokemon-info/sources"
import { generatedListResponseSchema, type SavedGeneratedPokemonType } from "@shared/api/schema/pokemon/generated"
import { seed } from "./utils/fixtures"

const URL_BASE = "http://localhost/api/pokemon/generated"

const post = (handler: (request: NextRequest) => Promise<Response>, path: string, body: unknown) => handler(
  new NextRequest(`${URL_BASE}${path}`, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) })
)

const list = (query = "") => LIST(new NextRequest(`${URL_BASE}${query}`))

const context = (id: string) => ({ params: Promise.resolve({ id }) })

const rows = () => db.select().from(generatedPokemonSchema).orderBy(asc(generatedPokemonSchema.createdAt))

const saveSingle = async (body: unknown) => {
  const response = await post(SAVE, "", body)

  expect(response.status).toBe(201)

  return ((await response.json()) as { data: SavedGeneratedPokemonType[] }).data
}

beforeEach(async () => {
  // Truncates generated_pokemon too
  await seed({ tags: [], pokemon: [] })
})

describe("POST /api/pokemon/generated/preview", () => {
  it("generates without writing, and saving with the same seed stores the same pokemon", async () => {
    const body = { request: { types: ["fire"] }, seed: 123 }
    const preview = await post(PREVIEW, "/preview", body)
    const { data: [previewed] } = await preview.json()

    expect(preview.status).toBe(200)
    expect(previewed).toMatchObject({ seed: 123, types: ["fire"], input: { mode: "single", request: { types: ["fire"] } } })
    expect(await rows()).toHaveLength(0)

    const [saved] = await saveSingle(body)
    expect(saved).toEqual({ ...previewed, id: expect.any(String), parentId: null })
    expect((await rows()).map(row => row.name)).toEqual([previewed.name])
  })

  it("picks a seed when none is given and returns it", async () => {
    const { data: [pokemon] } = await (await post(PREVIEW, "/preview", {})).json()

    expect(Number.isInteger(pokemon.seed)).toBe(true)
  })

  it("answers 400 with the violations of a contradictory request", async () => {
    const response = await post(PREVIEW, "/preview", { request: { class: "legendary", bst: 300 } })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.violations[0]).toMatch(/outside the tier/)
  })

  it("answers 400 on a malformed body", async () => {
    expect((await post(PREVIEW, "/preview", "not json")).status).toBe(400)
    expect((await post(PREVIEW, "/preview", { request: { types: ["shadow"] } })).status).toBe(400)
    expect((await post(PREVIEW, "/preview", { mode: "mega" })).status).toBe(400)
  })
})

describe("POST /api/pokemon/generated", () => {
  it("answers 409 when the name is taken", async () => {
    await saveSingle({ seed: 5 })

    const response = await post(SAVE, "", { seed: 5 })

    expect(response.status).toBe(409)
    expect(await rows()).toHaveLength(1)
  })

  it("does not reuse the name of a downloaded pokemon", async () => {
    await db.insert(pokemonInfoSchema).values({
      sourceId: INFO_SOURCES.pokeapi,
      externalId: 25,
      name: "pikachu",
      types: ["electric"],
      abilities: ["static"],
      heightDm: 4,
      weightHg: 60,
      baseExperience: 112,
      stats: { hp: 35, attack: 55, defense: 40, specialAttack: 50, specialDefense: 50, speed: 90 }
    })

    const response = await post(SAVE, "", { request: { name: "pikachu" } })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ names: ["pikachu"] })
  })

  it("saves a line in one go with parent links, and a mega form of its final stage", async () => {
    const line = await saveSingle({ mode: "line", request: { length: 3 }, seed: 9 })

    expect(line.map(item => item.stage)).toEqual([{ index: 1, of: 3 }, { index: 2, of: 3 }, { index: 3, of: 3 }])
    expect(line.map(item => item.parentId)).toEqual([null, line[0].id, line[1].id])
    expect((await rows()).map(row => row.id)).toEqual(line.map(item => item.id))

    const [mega] = await saveSingle({ mode: "mega", baseId: line[2].id, seed: 1 })

    expect(mega).toMatchObject({ form: "mega", parentId: line[2].id, input: { mode: "mega", baseId: line[2].id } })
    expect(mega.stats.hp).toBe(line[2].stats.hp)
  })

  it("answers 404 for a mega form of an unknown base and 400 for an ineligible one", async () => {
    const missing = await post(SAVE, "", { mode: "mega", baseId: "00000000-0000-4000-8000-000000000000" })

    expect(missing.status).toBe(404)

    const [first] = await saveSingle({ mode: "line", request: { length: 2 }, seed: 3 })

    expect((await post(SAVE, "", { mode: "mega", baseId: first.id })).status).toBe(400)
  })
})

describe("hand-made pokemon (mode custom)", () => {
  const pokemon = {
    name: "handmade",
    class: "single",
    types: ["water", "fairy"],
    abilities: ["huge-power"],
    stats: { hp: 100, attack: 50, defense: 80, specialAttack: 60, specialDefense: 80, speed: 50 }
  }

  it("saves the stats as given and the preview with the same seed matches", async () => {
    const { data: [previewed] } = await (await post(PREVIEW, "/preview", { mode: "custom", pokemon, seed: 4 })).json()
    const [saved] = await saveSingle({ mode: "custom", pokemon, seed: 4 })

    expect(saved).toEqual({ ...previewed, id: expect.any(String), parentId: null })
    expect(saved).toMatchObject({ name: "handmade", stats: pokemon.stats, input: { mode: "custom", pokemon } })
  })

  it("answers 400 with the violations of implausible stats", async () => {
    const response = await post(SAVE, "", { mode: "custom", pokemon: { ...pokemon, stats: { ...pokemon.stats, hp: 3 } } })

    expect(response.status).toBe(400)
    expect((await response.json()).violations.length).toBeGreaterThan(0)
  })
})

describe("GET and DELETE /api/pokemon/generated/[id]", () => {
  it("returns a saved pokemon, deletes it and unlinks its children", async () => {
    const line = await saveSingle({ mode: "line", request: { length: 2 }, seed: 11 })

    const found = await GET_ONE(new NextRequest(`${URL_BASE}/${line[0].id}`), context(line[0].id))

    expect(found.status).toBe(200)
    // explain is not stored; toEqual ignores the undefined key
    expect((await found.json()).data).toEqual({ ...line[0], explain: undefined })

    const deleted = await DELETE(new NextRequest(`${URL_BASE}/${line[0].id}`), context(line[0].id))

    expect(deleted.status).toBe(204)
    expect((await GET_ONE(new NextRequest(`${URL_BASE}/${line[0].id}`), context(line[0].id))).status).toBe(404)

    const child = await (await GET_ONE(new NextRequest(`${URL_BASE}/${line[1].id}`), context(line[1].id))).json()

    expect(child.data.parentId).toBeNull()
  })

  it("answers 404 for unknown and malformed ids", async () => {
    expect((await GET_ONE(new NextRequest(`${URL_BASE}/x`), context("x"))).status).toBe(404)
    expect((await DELETE(new NextRequest(`${URL_BASE}/x`), context("x"))).status).toBe(404)
    expect((await DELETE(
      new NextRequest(`${URL_BASE}/00000000-0000-4000-8000-000000000000`),
      context("00000000-0000-4000-8000-000000000000")
    )).status).toBe(404)
  })
})

describe("GET /api/pokemon/generated", () => {
  beforeEach(async () => {
    await saveSingle({ request: { types: ["fire", "flying"], class: "single", name: "a-fire-flying" }, seed: 1 })
    await saveSingle({ request: { types: ["fire"], class: "single", name: "b-fire" }, seed: 2 })
    await saveSingle({ request: { types: ["water", "fire"], class: "legendary", name: "c-water-fire" }, seed: 3 })
    await saveSingle({ request: { types: ["water"], class: "single", name: "d-water" }, seed: 4 })
  })

  const names = async (query: string) => {
    const response = await list(query)
    const body = generatedListResponseSchema.parse(await response.json())

    return { status: response.status, names: body.data.map(item => item.name), total: body.pagination.total }
  }

  it("filters by types with AND semantics, oldest first", async () => {
    expect(await names("?page=0&limit=10&types=fire")).toEqual({
      status: 200, names: ["a-fire-flying", "b-fire", "c-water-fire"], total: 3
    })
    expect(await names("?page=0&limit=10&types=fire&types=flying")).toEqual({ status: 200, names: ["a-fire-flying"], total: 1 })
    expect(await names("?page=0&limit=10&types=")).toMatchObject({ total: 4 })
  })

  it("filters by class and paginates with the total of the filter", async () => {
    expect(await names("?page=0&limit=10&class=legendary")).toMatchObject({ names: ["c-water-fire"], total: 1 })
    expect(await names("?page=1&limit=2")).toEqual({ status: 200, names: ["c-water-fire", "d-water"], total: 4 })
    expect(await names("?page=0&limit=2&types=fire")).toMatchObject({ names: ["a-fire-flying", "b-fire"], total: 3 })
  })

  it("lists newest first with order=desc", async () => {
    expect(await names("?page=0&limit=2&order=desc")).toMatchObject({ names: ["d-water", "c-water-fire"], total: 4 })
  })

  it("answers 400 on invalid parameters", async () => {
    expect((await list("?page=0&limit=10&order=random")).status).toBe(400)
    expect((await list("?page=0&limit=10&types=shadow")).status).toBe(400)
    expect((await list("?page=0&limit=10&class=boss")).status).toBe(400)
    expect((await list("?page=-1&limit=10")).status).toBe(400)
  })
})
