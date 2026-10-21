import { afterEach, describe, expect, it, vi } from "vitest"
import { fetchAbilityInfo, fetchPokemonInfo, PokeapiPermanentError } from "@/server/pokemon-info/pokeapi"
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
    { is_hidden: true, slot: 3, ability: { name: "lightning-rod", url: "https://pokeapi.co/api/v2/ability/31/" } },
    { is_hidden: false, slot: 1, ability: { name: "static", url: "https://pokeapi.co/api/v2/ability/9/" } }
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

// Trimmed real response of GET /api/v2/ability/static/
const STATIC = {
  id: 9,
  name: "static",
  is_main_series: true,
  generation: { name: "generation-iii", url: "" },
  names: [
    { name: "Statik", language: { name: "de", url: "" } },
    { name: "Static", language: { name: "en", url: "" } }
  ],
  effect_entries: [
    { effect: "Statique", short_effect: "Paralyse", language: { name: "fr", url: "" } },
    {
      effect: "Whenever a move makes contact with this Pokémon,\nthe move's user has a 30% chance of being paralyzed.",
      short_effect: "Has a 30% chance of paralyzing attacking Pokémon on contact.",
      language: { name: "en", url: "" }
    }
  ],
  flavor_text_entries: [
    { flavor_text: "Old text", language: { name: "en", url: "" }, version_group: { name: "ruby-sapphire", url: "" } },
    { flavor_text: "Contact may\fcause paralysis.", language: { name: "en", url: "" }, version_group: { name: "sv", url: "" } }
  ],
  effect_changes: [],
  pokemon: []
}

describe("fetchAbilityInfo", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("requests the ability by name and keeps English texts with normalized whitespace", async () => {
    const fetchSpy = mockFetch(200, STATIC)

    expect(await fetchAbilityInfo("static")).toEqual({
      sourceId: INFO_SOURCES.pokeapi,
      externalId: 9,
      name: "static",
      displayName: "Static",
      effect: "Whenever a move makes contact with this Pokémon, the move's user has a 30% chance of being paralyzed.",
      shortEffect: "Has a 30% chance of paralyzing attacking Pokémon on contact.",
      flavorText: "Contact may cause paralysis.",
      generation: "generation-iii",
      isMainSeries: true
    })
    expect(fetchSpy.mock.calls[0][0]).toBe("https://pokeapi.co/api/v2/ability/static/")
  })

  it("returns null texts when there are no English entries", async () => {
    mockFetch(200, { ...STATIC, names: [], effect_entries: [], flavor_text_entries: [], is_main_series: false })

    expect(await fetchAbilityInfo("9")).toMatchObject({ displayName: null, effect: null, shortEffect: null, flavorText: null })
  })

  it("throws a permanent error for an unknown ability", async () => {
    mockFetch(404)

    await expect(fetchAbilityInfo("nope")).rejects.toBeInstanceOf(PokeapiPermanentError)
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
