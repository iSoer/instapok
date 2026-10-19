import { describe, expect, it } from "vitest"
import { listRequestSchema, MAX_TAGS } from "@shared/api/schema/pokemon/list"

const A = "6f1c2b0e-8a3d-4c55-9b1e-2d7f0a9c4e11"
const B = "0b7e4a52-1f6c-4d8e-a3b9-5c2d1e0f7a66"

const parse = (tags: unknown) => listRequestSchema.safeParse({ page: "0", limit: "20", tags })

const uuid = (index: number) => `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`

describe("listRequestSchema tags", () => {
  it.each([
    ["missing", undefined, []],
    ["an empty array", [], []],
    ["a single empty value", [""], []],
    ["a bare empty string", "", []],
    ["a single tag", [A], [A]],
    ["a single tag as a string", A, [A]],
    ["several tags", [A, B], [A, B]],
    ["duplicates", [A, B, A], [A, B]],
    ["empty values mixed with tags", ["", A, ""], [A]]
  ])("accepts %s", (_, tags, expected) => {
    const result = parse(tags)

    expect(result.success).toBe(true)
    expect(result.data?.tags).toEqual(expected)
  })

  it.each([
    ["a non-UUID tag", ["shiny"]],
    ["a non-UUID among valid tags", [A, "not-a-uuid"]],
    ["a non-string tag", [42]],
    ["an object", { id: A }],
    ["too many distinct tags", Array.from({ length: MAX_TAGS + 1 }, (_, index) => uuid(index))]
  ])("rejects %s", (_, tags) => {
    expect(parse(tags).success).toBe(false)
  })

  it("counts the limit after removing duplicates", () => {
    const tags = [...Array.from({ length: MAX_TAGS }, (_, index) => uuid(index)), uuid(0)]

    expect(parse(tags).success).toBe(true)
  })
})
