import type { PokemonType, Stat } from "@shared/api/schema/pokemon/generated"

// Usual colors of the pokemon types; also the fill of the stat sliders for the primary type
export const TYPE_COLORS: Record<PokemonType, string> = {
  normal: "#a8a77a",
  fire: "#ee8130",
  water: "#6390f0",
  electric: "#f7d02c",
  grass: "#7ac74c",
  ice: "#96d9d6",
  fighting: "#c22e28",
  poison: "#a33ea1",
  ground: "#e2bf65",
  flying: "#a98ff3",
  psychic: "#f95587",
  bug: "#a6b91a",
  rock: "#b6a136",
  ghost: "#735797",
  dragon: "#6f35fc",
  dark: "#705746",
  steel: "#b7b7ce",
  fairy: "#d685ad"
}

export const DEFAULT_COLOR = "#3b82f6"

export const STAT_LABELS: Record<Stat, string> = {
  hp: "HP",
  attack: "Attack",
  defense: "Defense",
  specialAttack: "Sp. Attack",
  specialDefense: "Sp. Defense",
  speed: "Speed"
}

export const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)

/** "lightning-rod" → "Lightning Rod" when the ability has no display name */
export const abilityLabel = (name: string, displayName?: string | null) => displayName
  ?? name.split("-").map(capitalize).join(" ")

// Text inputs of the generator page
export const FIELD_CLASS = "w-full py-6 px-8 bg-neutral-800 border border-neutral-700 text-gray-200 "
  + "focus:outline-none focus:border-blue-500"
