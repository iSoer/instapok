import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/server/db/queries/listAbilities", () => ({
  listAbilities: vi.fn(async () => {
    throw new Error("connect ECONNREFUSED 127.0.0.1:5432 password=secret")
  })
}))

const { GET } = await import("@/app/api/pokemon/abilities/route")

describe("GET /api/pokemon/abilities errors", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns a generic 500 without driver details when the database fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})

    const response = await GET()
    const text = await response.text()

    expect(response.status).toBe(500)
    expect(JSON.parse(text)).toEqual({ error: "Error when collecting abilities" })
    expect(text).not.toMatch(/ECONNREFUSED|secret/)
    expect(console.error).toHaveBeenCalled()
  })
})
