import type { PokemonStats } from "@schema/pokemonInfoSchema"

/**
 * Services pokemon info is downloaded from, stored in `pokemon_info.source_id`.
 * The codes are persisted: never renumber them, only append.
 */
export const INFO_SOURCES = {
  pokeapi: 0
} as const

export type InfoSourceId = typeof INFO_SOURCES[keyof typeof INFO_SOURCES]

/** One pokemon as returned by a source, ready to be written into `pokemon_info` */
export type PokemonInfo = {
  sourceId: InfoSourceId
  // Pokemon number in that source; matches the numeric part of `pokemon.alt`
  externalId: number
  name: string
  types: string[]
  abilities: string[]
  heightDm: number
  weightHg: number
  baseExperience: number | null
  stats: PokemonStats
}
