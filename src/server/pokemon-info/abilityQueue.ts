import { createQueue, type QueueOptions } from "./createQueue"
import { fetchAbilityInfo } from "./pokeapi"
import type { AbilityInfo } from "./sources"
import { saveAbility } from "@/server/db/queries/saveAbility"

export type AbilityQueueOptions = Omit<QueueOptions<string>, "worker"> & {
  fetchInfo?: (ability: string, signal: AbortSignal) => Promise<AbilityInfo>
  saveInfo?: (info: AbilityInfo) => Promise<void>
}

/** Queue of PokeAPI ability names (or ids): each one is fetched and upserted into `ability` */
export const createAbilityQueue = ({
  fetchInfo = fetchAbilityInfo,
  saveInfo = saveAbility,
  ...options
}: AbilityQueueOptions = {}) => createQueue<string>({
  ...options,
  worker: async (ability, signal) => {
    await saveInfo(await fetchInfo(ability, signal))
  }
})
