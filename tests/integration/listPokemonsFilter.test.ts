import { beforeAll, describe, expect, it } from "vitest"
import { NextRequest } from "next/server"
import { GET } from "@/app/api/pokemon/list/route"
import { listPokemons } from "@/server/db/queries/listPokemons"
import { listResponseSchema, type ListResponseType } from "@shared/api/schema/pokemon/list"
import { seed } from "./utils/fixtures"

const UNKNOWN_TAG = "00000000-0000-4000-8000-000000000000"

// Insertion order defines the expected response order
const POKEMONS = [
  { name: "none" },
  { name: "a", tags: ["A"] },
  { name: "b", tags: ["B"] },
  { name: "ab", tags: ["A", "B"] },
  { name: "abc", tags: ["A", "B", "C"] },
  { name: "c", tags: ["C"] }
]

let tagIds: Record<string, string>

const request = async (query: string) => {
  const response = await GET(new NextRequest(`http://localhost/api/pokemon/list?${query}`))

  return { status: response.status, body: await response.json() }
}

const tagsQuery = (...names: string[]) => names.map(name => `tags=${tagIds[name] ?? name}`).join("&")

const names = (body: ListResponseType) => body.data.map(item => item.name)

beforeAll(async () => {
  ({ tagIds } = await seed({ tags: ["A", "B", "C"], pokemons: POKEMONS }))
})

describe("GET /api/pokemon/list — tag filter", () => {
  it.each([
    ["tags omitted", "page=0&limit=50"],
    ["empty tags value (sent by the current client)", "page=0&limit=50&tags="],
    ["only empty tags values", "page=0&limit=50&tags=&tags="]
  ])("returns every pokemon in insertion order when %s", async (_, query) => {
    const { status, body } = await request(query)

    expect(status).toBe(200)
    expect(names(body)).toEqual(["none", "a", "b", "ab", "abc", "c"])
    expect(body.pagination).toEqual({ count: 6, total: 6 })
  })

  it("filters by a single tag", async () => {
    const { body } = await request(`page=0&limit=50&${tagsQuery("A")}`)

    expect(names(body)).toEqual(["a", "ab", "abc"])
    expect(body.pagination.total).toBe(3)
  })

  it("uses AND semantics for several tags and excludes partial matches", async () => {
    const { body } = await request(`page=0&limit=50&${tagsQuery("A", "B")}`)

    expect(names(body)).toEqual(["ab", "abc"])
    expect(body.pagination.total).toBe(2)
  })

  it("requires every tag", async () => {
    expect(names((await request(`page=0&limit=50&${tagsQuery("A", "B", "C")}`)).body)).toEqual(["abc"])
    expect(names((await request(`page=0&limit=50&${tagsQuery("B", "C")}`)).body)).toEqual(["abc"])
  })

  it("treats duplicate tags like distinct ones", async () => {
    const { body } = await request(`page=0&limit=50&${tagsQuery("A", "B", "A")}`)

    expect(names(body)).toEqual(["ab", "abc"])
    expect(body.pagination.total).toBe(2)
  })

  it("does not duplicate pokemons and keeps their unrequested tags", async () => {
    const { body } = await request(`page=0&limit=50&${tagsQuery("A", "B")}`)
    const abc = body.data.find((item: { name: string }) => item.name === "abc")

    expect(new Set(names(body)).size).toBe(body.data.length)
    expect(abc.tags.map((tag: { name: string }) => tag.name).sort()).toEqual(["A", "B", "C"])
  })

  it.each([
    ["an unknown tag", [UNKNOWN_TAG]],
    ["a known and an unknown tag", ["A", UNKNOWN_TAG]]
  ])("returns an empty list for %s", async (_, tags) => {
    const { status, body } = await request(`page=0&limit=50&${tagsQuery(...tags)}`)

    expect(status).toBe(200)
    expect(body.data).toEqual([])
    expect(body.pagination).toEqual({ count: 0, total: 0 })
  })

  it("paginates the filtered set with a stable total", async () => {
    const first = await request(`page=0&limit=2&${tagsQuery("A")}`)
    const second = await request(`page=1&limit=2&${tagsQuery("A")}`)
    const beyond = await request(`page=5&limit=2&${tagsQuery("A")}`)

    expect(names(first.body)).toEqual(["a", "ab"])
    expect(names(second.body)).toEqual(["abc"])
    expect(beyond.body.data).toEqual([])
    expect([first, second, beyond].map(({ body }) => body.pagination.total)).toEqual([3, 3, 3])
    expect([first, second, beyond].map(({ body }) => body.pagination.count)).toEqual([2, 1, 0])
  })

  it("paginates the unfiltered set", async () => {
    const pages = await Promise.all([0, 1, 2].map(page => request(`page=${page}&limit=2`)))

    expect(pages.flatMap(({ body }) => names(body))).toEqual(["none", "a", "b", "ab", "abc", "c"])
  })

  it("returns a response that matches the declared schema", async () => {
    const { body } = await request(`page=0&limit=50&${tagsQuery("A")}`)

    expect(listResponseSchema.safeParse(body).success).toBe(true)
  })

  it("rejects a non-UUID tag instead of ignoring it", async () => {
    const { status } = await request("page=0&limit=50&tags=shiny")

    expect(status).toBe(400)
  })
})

describe("listPokemons", () => {
  it("returns the same rows and total as the route for the same filter", async () => {
    const result = await listPokemons({ page: 0, limit: 50, tags: [tagIds.A, tagIds.B] })

    expect(result.data.map(item => item.name)).toEqual(["ab", "abc"])
    expect(result.total).toBe(2)
  })

  it("deduplicates tags itself", async () => {
    const result = await listPokemons({ page: 0, limit: 50, tags: [tagIds.C, tagIds.C] })

    expect(result.data.map(item => item.name)).toEqual(["abc", "c"])
  })

  it("does not filter when the tag list is empty", async () => {
    const result = await listPokemons({ page: 0, limit: 50, tags: [] })

    expect(result.total).toBe(POKEMONS.length)
  })
})
