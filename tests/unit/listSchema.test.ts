import { describe, expect, it } from "vitest"
import { listRequestSchema, listResponseSchema } from "@shared/api/schema/pokemon/list"

describe("listRequestSchema", () => {
  it("coerces page and limit from query strings", () => {
    const result = listRequestSchema.safeParse({ page: "1", limit: "20" })

    expect(result.success).toBe(true)
    expect(result.data).toMatchObject({ page: 1, limit: 20 })
  })

  it.each([
    ["negative page", { page: "-1", limit: "20" }],
    ["fractional page", { page: "1.5", limit: "20" }],
    ["zero limit", { page: "0", limit: "0" }],
    ["non-numeric limit", { page: "0", limit: "abc" }],
    ["missing page", { limit: "20" }]
  ])("rejects %s", (_, input) => {
    expect(listRequestSchema.safeParse(input).success).toBe(false)
  })
})

describe("listResponseSchema", () => {
  it("accepts a valid payload", () => {
    const result = listResponseSchema.safeParse({
      data: [{ id: "1", name: "1", width: 96, height: 96, alt: "1", tags: [{ id: "t", name: "shiny" }] }],
      pagination: { count: 1 }
    })

    expect(result.success).toBe(true)
  })

  it("rejects items with missing fields", () => {
    const result = listResponseSchema.safeParse({
      data: [{ id: "1", name: "1" }],
      pagination: { count: 1 }
    })

    expect(result.success).toBe(false)
  })
})
