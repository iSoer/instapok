import { beforeAll, describe, expect, it } from "vitest"
import { NextRequest } from "next/server"
import { GET } from "@/app/api/pokemon/list/route"
import { listResponseSchema } from "@shared/api/schema/pokemon/list"
import { seed } from "./utils/fixtures"

const request = (query: string) => GET(new NextRequest(`http://localhost/api/pokemon/list?${query}`))

describe("GET /api/pokemon/list (smoke)", () => {
  beforeAll(async () => {
    await seed({
      tags: ["shiny"],
      pokemon: [
        { name: "1" },
        { name: "1.shiny", tags: ["shiny"] },
        { name: "2" }
      ]
    })
  })

  it("returns a page of pokemon with flattened tags", async () => {
    const response = await request("page=0&limit=2")
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(listResponseSchema.safeParse(body).success).toBe(true)
    expect(body.data).toHaveLength(2)
    body.data.forEach((item: { tags: unknown }) => expect(Array.isArray(item.tags)).toBe(true))
  })

  it("rejects invalid pagination", async () => {
    const response = await request("page=-1&limit=2")

    expect(response.status).toBe(400)
  })
})
