import { beforeEach, describe, expect, it } from "vitest"
import { NextRequest } from "next/server"
import { asc } from "drizzle-orm"
import { db, generatedCharacterSchema } from "@db"
import { GET as LIST, POST as SAVE } from "@/app/api/character/generated/route"
import { POST as PREVIEW } from "@/app/api/character/generated/preview/route"
import { GET as MODEL } from "@/app/api/character/generated/model/route"
import { DELETE, GET as GET_ONE, PATCH } from "@/app/api/character/generated/[id]/route"
import {
  characterModelResponseSchema, generatedCharacterItemResponseSchema, generatedCharacterListResponseSchema,
  type SavedGeneratedCharacterType
} from "@shared/api/schema/character/generated"
import { availableClasses } from "@shared/character/classes"
import { seed } from "./utils/fixtures"

const URL_BASE = "http://localhost/api/character/generated"

const post = (handler: (request: NextRequest) => Promise<Response>, path: string, body: unknown) => handler(
  new NextRequest(`${URL_BASE}${path}`, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) })
)

const list = (query: string) => LIST(new NextRequest(`${URL_BASE}?page=0&limit=10${query}`))

const context = (id: string) => ({ params: Promise.resolve({ id }) })

const getOne = (id: string) => GET_ONE(new NextRequest(`${URL_BASE}/${id}`), context(id))

const patch = (id: string, body: unknown) => PATCH(
  new NextRequest(`${URL_BASE}/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  context(id)
)

const rows = () => db.select().from(generatedCharacterSchema).orderBy(asc(generatedCharacterSchema.createdAt))

const saveOne = async (body: unknown) => {
  const response = await post(SAVE, "", body)

  expect(response.status).toBe(201)

  return ((await response.json()) as { data: SavedGeneratedCharacterType[] }).data[0]
}

const maxStats = { hp: 75, attack: 80, defense: 70, specialAttack: 70, specialDefense: 70, speed: 80 }

beforeEach(async () => {
  // Truncates generated_character too
  await seed({ tags: [], pokemon: [] })
})

describe("POST /api/character/generated/preview", () => {
  it("generates without writing, and saving with the same seed stores the same character", async () => {
    const body = { request: { rarity: 4, class: "archer" }, seed: 123 }
    const preview = await post(PREVIEW, "/preview", body)
    const { data: [previewed] } = await preview.json()

    expect(preview.status).toBe(200)
    expect(previewed).toMatchObject({ seed: 123, rarity: 4, class: "archer", level: 20, input: { mode: "single" } })
    expect(await rows()).toHaveLength(0)

    const saved = await saveOne(body)

    expect(saved).toEqual({ ...previewed, id: expect.any(String) })
    expect((await rows()).map(row => [row.name, row.classTier])).toEqual([[previewed.name, "specialty"]])
  })

  it("checks hand-made characters and answers 400 with the violations", async () => {
    const character = { rarity: 1, talents: ["sword"], weaknesses: ["bow"], maxStats, level: 20, class: "myrmidon" }

    expect((await post(PREVIEW, "/preview", { mode: "custom", character, seed: 1 })).status).toBe(200)

    const locked = await post(PREVIEW, "/preview", { mode: "custom", character: { ...character, class: "archer" } })

    expect(locked.status).toBe(400)
    expect((await locked.json()).violations.join()).toMatch(/not open at level 20/)
  })

  it("answers 400 on a malformed body or a contradictory request", async () => {
    expect((await post(PREVIEW, "/preview", "not json")).status).toBe(400)
    expect((await post(PREVIEW, "/preview", { request: { class: "pegasus-knight" } })).status).toBe(400)
    expect((await post(PREVIEW, "/preview", { request: { class: "sniper", level: 10 } })).status).toBe(400)
  })
})

describe("POST /api/character/generated", () => {
  it("answers 409 when the name is taken", async () => {
    await saveOne({ seed: 5 })

    expect((await post(SAVE, "", { seed: 5 })).status).toBe(409)
    expect(await rows()).toHaveLength(1)
  })

  it("lets only one character hold a divine class", async () => {
    await saveOne({ request: { class: "the-blade" }, seed: 1 })

    const second = await post(SAVE, "", { request: { class: "the-blade" }, seed: 2 })

    expect(second.status).toBe(409)
    expect(await second.json()).toMatchObject({ class: "the-blade" })
    // Another divine class is fine
    await saveOne({ request: { class: "the-trident" }, seed: 3 })
  })
})

describe("GET /api/character/generated", () => {
  it("filters by rarity and class and pages newest first", async () => {
    await saveOne({ request: { rarity: 2, class: "archer" }, seed: 1 })
    await saveOne({ request: { rarity: 5, class: "archer" }, seed: 2 })
    await saveOne({ request: { rarity: 5, class: "priest" }, seed: 3 })

    const fiveStars = generatedCharacterListResponseSchema.parse(await (await list("&rarity=5&order=desc")).json())

    expect(fiveStars.data.map(item => item.class)).toEqual(["priest", "archer"])

    const archers = generatedCharacterListResponseSchema.parse(await (await list("&class=archer")).json())

    expect(archers.data.map(item => item.rarity)).toEqual([2, 5])
    expect((await list("&rarity=9")).status).toBe(400)
    expect((await list("&class=pegasus-knight")).status).toBe(400)
  })
})

describe("GET, PATCH and DELETE /api/character/generated/[id]", () => {
  it("returns the character with the classes open at its level", async () => {
    const saved = await saveOne({ request: { class: "myrmidon" }, seed: 11 })
    const body = generatedCharacterItemResponseSchema.parse(await (await getOne(saved.id)).json())

    expect(body.availableClasses).toEqual(availableClasses(saved.aptitudes, saved.level).map(item => item.id))
    expect(body.availableClasses).toContain("myrmidon")
    expect((await getOne("not-a-uuid")).status).toBe(404)
  })

  it("levels up, reclasses into open classes and refuses the rest", async () => {
    const saved = await saveOne({ request: { class: "myrmidon", talents: ["sword"] }, seed: 12 })

    const leveled = await patch(saved.id, { level: 35 })
    const { data } = generatedCharacterItemResponseSchema.parse(await leveled.json())

    expect(data).toMatchObject({ level: 35, class: "myrmidon" })
    expect(data.stats).not.toEqual(saved.stats)

    expect((await patch(saved.id, { class: "shido" })).status).toBe(200)
    expect((await patch(saved.id, { class: "swordmaster" })).status).toBe(400)
    expect((await patch(saved.id, { level: 10 })).status).toBe(400)
    expect((await patch(saved.id, {})).status).toBe(400)
    expect((await rows())[0]).toMatchObject({ level: 35, class: "shido", classTier: "advanced" })
  })

  it("refuses to reclass into a divine class someone else holds", async () => {
    await saveOne({ request: { class: "the-blade" }, seed: 1 })

    const other = await saveOne({ request: { class: "swordmaster", talents: ["sword"], level: 60 }, seed: 2 })

    expect((await patch(other.id, { class: "the-blade" })).status).toBe(409)
  })

  it("deletes once", async () => {
    const saved = await saveOne({ seed: 13 })

    expect((await DELETE(new NextRequest(`${URL_BASE}/${saved.id}`), context(saved.id))).status).toBe(204)
    expect((await DELETE(new NextRequest(`${URL_BASE}/${saved.id}`), context(saved.id))).status).toBe(404)
  })
})

describe("GET /api/character/generated/model", () => {
  it("sends five rarities and the class tier levels", async () => {
    const { data } = characterModelResponseSchema.parse(await (await MODEL()).json())

    expect(data.rarities.map(item => item.rarity)).toEqual([1, 2, 3, 4, 5])
    expect(data.tiers.map(item => item.level)).toEqual([1, 5, 20, 35, 45, 60])
  })
})
