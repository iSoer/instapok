import { afterEach, describe, expect, it, vi } from "vitest"
import { fetchPokemonInfo, PokeapiPermanentError } from "@/server/pokemon-info/pokeapi"
import { parseIds } from "@/server/pokemon-info/parseIds"
import { INFO_SOURCES } from "@/server/pokemon-info/sources"

// Trimmed real response of GET /api/v2/pokemon/25/
const PIKACHU = {
  id: 25,
  name: "pikachu",
  height: 4,
  weight: 60,
  base_experience: 112,
  types: [{ slot: 1, type: { name: "electric", url: "" } }],
  abilities: [
    { is_hidden: true, slot: 3, ability: { name: "lightning-rod", url: "" } },
    { is_hidden: false, slot: 1, ability: { name: "static", url: "" } }
  ],
  stats: [
    { base_stat: 35, effort: 0, stat: { name: "hp", url: "" } },
    { base_stat: 55, effort: 0, stat: { name: "attack", url: "" } },
    { base_stat: 40, effort: 0, stat: { name: "defense", url: "" } },
    { base_stat: 50, effort: 0, stat: { name: "special-attack", url: "" } },
    { base_stat: 50, effort: 0, stat: { name: "special-defense", url: "" } },
    { base_stat: 90, effort: 2, stat: { name: "speed", url: "" } }
  ],
  sprites: {}
}

const mockFetch = (status: number, body: unknown = {}) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status }))

describe("INFO_SOURCES", () => {
  it("stores PokeAPI as source 0", () => {
    expect(INFO_SOURCES.pokeapi).toBe(0)
  })
})

describe("fetchPokemonInfo", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("requests the pokemon by id and maps the payload", async () => {
    const fetchSpy = mockFetch(200, PIKACHU)

    expect(await fetchPokemonInfo(25)).toEqual({
      sourceId: INFO_SOURCES.pokeapi,
      externalId: 25,
      name: "pikachu",
      types: ["electric"],
      abilities: ["static", "lightning-rod"],
      heightDm: 4,
      weightHg: 60,
      baseExperience: 112,
      stats: { hp: 35, attack: 55, defense: 40, specialAttack: 50, specialDefense: 50, speed: 90 }
    })
    expect(fetchSpy.mock.calls[0][0]).toBe("https://pokeapi.co/api/v2/pokemon/25/")
  })

  it.each([
    ["404", 404, {}],
    ["400", 400, {}],
    ["an unexpected payload", 200, { id: 25 }]
  ])("throws a permanent error for %s", async (_, status, body) => {
    mockFetch(status, body)

    await expect(fetchPokemonInfo(25)).rejects.toBeInstanceOf(PokeapiPermanentError)
  })

  it.each([429, 503])("throws a retryable error for %i", async (status) => {
    mockFetch(status)

    const error = await fetchPokemonInfo(25).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(Error)
    expect(error).not.toBeInstanceOf(PokeapiPermanentError)
  })
})

describe("parseIds", () => {
  it("expands ids and ranges", () => {
    expect(parseIds(["1", "4-6", "10"])).toEqual([1, 4, 5, 6, 10])
  })

  it.each([["abc"], ["5-3"], ["-1"]])("rejects %s", (arg) => {
    expect(() => parseIds([arg])).toThrow()
  })
})
