import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/server/db/queries/listPokemons", () => ({
  listPokemons: vi.fn(async () => {
    throw new Error("connect ECONNREFUSED 127.0.0.1:5432 password=secret")
  })
}))

const { GET } = await import("@/app/api/pokemon/list/route")

const request = (query: string) => GET(new NextRequest(`http://localhost/api/pokemon/list?${query}`))

describe("GET /api/pokemon/list errors", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns a generic 500 without driver details when the database fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})

    const response = await request("page=0&limit=20")
    const text = await response.text()

    expect(response.status).toBe(500)
    expect(JSON.parse(text)).toEqual({ error: "Error when collecting pokemons" })
    expect(text).not.toMatch(/ECONNREFUSED|secret/)
    expect(console.error).toHaveBeenCalled()
  })

  it.each([
    ["missing page", "limit=20"],
    ["missing limit", "page=0"],
    ["negative page", "page=-1&limit=20"],
    ["invalid tag", "page=0&limit=20&tags=fire"]
  ])("returns 400 for %s", async (_, query) => {
    const response = await request(query)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe("Invalid query parameters")
  })
})
