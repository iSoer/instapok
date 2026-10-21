import { createQueue, type QueueOptions } from "./createQueue"
import { fetchPokemonInfo } from "./pokeapi"
import type { PokemonInfo } from "./sources"
import { savePokemonInfo } from "@/server/db/queries/savePokemonInfo"

export type PokemonInfoQueueOptions = Omit<QueueOptions<number>, "worker"> & {
  fetchInfo?: (id: number, signal: AbortSignal) => Promise<PokemonInfo>
  saveInfo?: (info: PokemonInfo) => Promise<number>
}

/** Thrown when PokeAPI knows the id but no sprite row carries that number */
export class NoMatchingRowsError extends Error {
  readonly retryable = false
}

/** Queue of PokeAPI pokemon ids: each one is fetched and written into the matching `pokemon` rows */
export const createPokemonInfoQueue = ({
  fetchInfo = fetchPokemonInfo,
  saveInfo = savePokemonInfo,
  ...options
}: PokemonInfoQueueOptions = {}) => createQueue<number>({
  ...options,
  worker: async (id, signal) => {
    const updated = await saveInfo(await fetchInfo(id, signal))

    if (updated === 0) {
      throw new NoMatchingRowsError(`No pokemon row with alt ${id}`)
    }
  }
})
