import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/server/db/queries/listGeneratedPokemon", () => ({
  listGeneratedPokemon: vi.fn(async () => {
    throw new Error("connect ECONNREFUSED 127.0.0.1:5432 password=secret")
  }),
  getGeneratedPokemon: vi.fn()
}))

vi.mock("@/server/db/queries/saveGeneratedPokemon", async importOriginal => ({
  ...await importOriginal<typeof import("@/server/db/queries/saveGeneratedPokemon")>(),
  saveGeneratedPokemon: vi.fn(async () => {
    throw new Error("connect ECONNREFUSED 127.0.0.1:5432 password=secret")
  })
}))

const { GET, POST } = await import("@/app/api/pokemon/generated/route")
const { POST: PREVIEW } = await import("@/app/api/pokemon/generated/preview/route")

const URL_BASE = "http://localhost/api/pokemon/generated"

describe("/api/pokemon/generated errors", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([
    ["GET", () => GET(new NextRequest(`${URL_BASE}?page=0&limit=10`)), "Error when collecting generated pokemon"],
    ["POST", () => POST(new NextRequest(URL_BASE, { method: "POST", body: "{}" })), "Error when trying to save generated pokemon"]
  ])("%s returns a generic 500 without driver details when the database fails", async (_, call, message) => {
    vi.spyOn(console, "error").mockImplementation(() => {})

    const response = await call()
    const text = await response.text()

    expect(response.status).toBe(500)
    expect(JSON.parse(text)).toEqual({ error: message })
    expect(text).not.toMatch(/ECONNREFUSED|secret/)
    expect(console.error).toHaveBeenCalled()
  })

  it("serves the public part of the model", async () => {
    const { GET: MODEL } = await import("@/app/api/pokemon/generated/model/route")
    const { generatorModelResponseSchema } = await import("@shared/api/schema/pokemon/generated")
    const response = await MODEL()
    const { data } = generatorModelResponseSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(data.classes.map(item => item.key)).toContain("stage3of3")
    expect(data.compensation["wonder-guard"]).toMatchObject({ fixedStats: { hp: 1 } })
    expect(data.abilities.find(ability => ability.name === "stance-change")?.formOnly).toBe(true)
  })

  it("previews a single pokemon without the database", async () => {
    const response = await PREVIEW(new NextRequest(`${URL_BASE}/preview`, { method: "POST", body: JSON.stringify({ seed: 1 }) }))

    expect(response.status).toBe(200)
    expect((await response.json()).data).toHaveLength(1)
  })
})
