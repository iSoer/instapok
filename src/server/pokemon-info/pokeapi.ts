import { z } from "zod"
import type { PokemonStats } from "@schema/pokemonInfoSchema"
import { INFO_SOURCES, type AbilityInfo, type PokemonInfo } from "./sources"

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

/** The request can't succeed on retry (unknown id or name, bad payload) */
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

/** GETs `path`, validates the body with `schema`; `label` names the resource in errors ("pokemon #25") */
const requestPokeapi = async <T>(path: string, schema: z.ZodType<T>, label: string, signal?: AbortSignal): Promise<T> => {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS)

  const response = await fetch(`${POKEAPI_URL}/${path}/`, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    headers: { accept: "application/json" }
  })

  if (response.status === 404) {
    throw new PokeapiPermanentError(`PokeAPI has no ${label}`)
  }

  // 429 and 5xx are worth retrying, other 4xx are not
  if (!response.ok) {
    const message = `PokeAPI responded ${response.status} for ${label}`

    throw response.status === 429 || response.status >= 500 ? new Error(message) : new PokeapiPermanentError(message)
  }

  const parsed = schema.safeParse(await response.json())

  if (!parsed.success) {
    throw new PokeapiPermanentError(`Unexpected PokeAPI payload for ${label}: ${parsed.error.message}`)
  }

  return parsed.data
}

export const fetchPokemonInfo = async (id: number, signal?: AbortSignal): Promise<PokemonInfo> =>
  toPokemonInfo(await requestPokeapi(`pokemon/${id}`, pokeapiPokemonSchema, `pokemon #${id}`, signal))

const localized = z.object({ language: namedResource })

const pokeapiAbilitySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  is_main_series: z.boolean(),
  generation: namedResource,
  names: z.array(localized.extend({ name: z.string() })),
  effect_entries: z.array(localized.extend({ effect: z.string(), short_effect: z.string() })),
  flavor_text_entries: z.array(localized.extend({ flavor_text: z.string() }))
})

const LANGUAGE = "en"

const inLanguage = <T extends z.infer<typeof localized>>(entries: T[]) =>
  entries.filter(entry => entry.language.name === LANGUAGE)

// Flavor texts keep the game's line breaks and form feeds
const normalizeText = (text: string) => text.replace(/\s+/g, " ").trim()

export const toAbilityInfo = (raw: z.infer<typeof pokeapiAbilitySchema>): AbilityInfo => {
  const effect = inLanguage(raw.effect_entries)[0]
  // Entries go from the oldest game to the newest
  const flavorText = inLanguage(raw.flavor_text_entries).at(-1)

  return {
    sourceId: INFO_SOURCES.pokeapi,
    externalId: raw.id,
    name: raw.name,
    displayName: inLanguage(raw.names)[0]?.name ?? null,
    effect: effect ? normalizeText(effect.effect) : null,
    shortEffect: effect ? normalizeText(effect.short_effect) : null,
    flavorText: flavorText ? normalizeText(flavorText.flavor_text) : null,
    generation: raw.generation.name,
    isMainSeries: raw.is_main_series
  }
}

/** `ability` is the PokeAPI name (`static`) or id */
export const fetchAbilityInfo = async (ability: string, signal?: AbortSignal): Promise<AbilityInfo> =>
  toAbilityInfo(await requestPokeapi(`ability/${ability}`, pokeapiAbilitySchema, `ability "${ability}"`, signal))
