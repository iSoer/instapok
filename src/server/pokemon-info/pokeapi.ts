import { z } from "zod"
import type { PokemonStats } from "@schema/pokemonInfoSchema"
import { INFO_SOURCES, type PokemonInfo } from "./sources"

export const POKEAPI_URL = "https://pokeapi.co/api/v2"

const REQUEST_TIMEOUT_MS = 10_000

const namedResource = z.object({ name: z.string() })

// Only the fields we store; PokeAPI returns much more
const pokeapiPokemonSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  height: z.number().int(),
  weight: z.number().int(),
  base_experience: z.number().int().nullable(),
  types: z.array(z.object({ slot: z.number(), type: namedResource })),
  abilities: z.array(z.object({ slot: z.number(), ability: namedResource })),
  stats: z.array(z.object({ base_stat: z.number().int(), stat: namedResource }))
})

const STAT_KEYS: Record<string, keyof PokemonStats> = {
  "hp": "hp",
  "attack": "attack",
  "defense": "defense",
  "special-attack": "specialAttack",
  "special-defense": "specialDefense",
  "speed": "speed"
}

/** The request can't succeed on retry (unknown id, bad payload) */
export class PokeapiPermanentError extends Error {
  readonly retryable = false
}

const bySlot = (a: { slot: number }, b: { slot: number }) => a.slot - b.slot

export const toPokemonInfo = (raw: z.infer<typeof pokeapiPokemonSchema>): PokemonInfo => {
  const stats: PokemonStats = { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 }

  for (const { base_stat, stat } of raw.stats) {
    const key = STAT_KEYS[stat.name]

    if (key) {
      stats[key] = base_stat
    }
  }

  return {
    sourceId: INFO_SOURCES.pokeapi,
    externalId: raw.id,
    name: raw.name,
    types: [...raw.types].sort(bySlot).map(({ type }) => type.name),
    abilities: [...raw.abilities].sort(bySlot).map(({ ability }) => ability.name),
    heightDm: raw.height,
    weightHg: raw.weight,
    baseExperience: raw.base_experience,
    stats
  }
}

export const fetchPokemonInfo = async (id: number, signal?: AbortSignal): Promise<PokemonInfo> => {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS)

  const response = await fetch(`${POKEAPI_URL}/pokemon/${id}/`, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    headers: { accept: "application/json" }
  })

  if (response.status === 404) {
    throw new PokeapiPermanentError(`PokeAPI has no pokemon #${id}`)
  }

  // 429 and 5xx are worth retrying, other 4xx are not
  if (!response.ok) {
    const message = `PokeAPI responded ${response.status} for pokemon #${id}`

    throw response.status === 429 || response.status >= 500 ? new Error(message) : new PokeapiPermanentError(message)
  }

  const parsed = pokeapiPokemonSchema.safeParse(await response.json())

  if (!parsed.success) {
    throw new PokeapiPermanentError(`Unexpected PokeAPI payload for pokemon #${id}: ${parsed.error.message}`)
  }

  return toPokemonInfo(parsed.data)
}
