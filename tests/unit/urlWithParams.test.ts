import { describe, expect, it } from "vitest"
import { urlWithParams } from "@api/helpers/urlWithParams"

const query = (url: string) => new URL(url).searchParams

describe("urlWithParams", () => {
  it("sets scalar params", () => {
    const params = query(urlWithParams("/api/pokemon/list", { page: 2, limit: 20 }))

    expect(params.get("page")).toBe("2")
    expect(params.get("limit")).toBe("20")
  })

  it("serializes arrays as repeated keys", () => {
    const params = query(urlWithParams("/api/pokemon/list", { tags: ["a", "b"] }))

    expect(params.getAll("tags")).toEqual(["a", "b"])
  })

  it("omits the key entirely for an empty array", () => {
    const params = query(urlWithParams("/api/pokemon/list", { tags: [] }))

    expect(params.has("tags")).toBe(false)
  })

  it("keeps empty strings as empty values", () => {
    const params = query(urlWithParams("/api/pokemon/list", { tags: "" }))

    expect(params.getAll("tags")).toEqual([""])
  })

  it("keeps the base path", () => {
    expect(new URL(urlWithParams("/api/pokemon/list", {})).pathname).toBe("/api/pokemon/list")
  })
})
