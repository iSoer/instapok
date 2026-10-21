import useSWR from "swr"
import { fetchFn } from "@shared/api/fetcher"
import type { CharacterModelType } from "@shared/api/schema/character/generated"

/** Rarity tiers, growth and ability pools of the character model; fixed per deployment, so never revalidated */
export function useCharacterModel() {
  return useSWR(
    "/api/character/generated/model",
    url => fetchFn<{ data: CharacterModelType }, void>({ url, method: "GET" }),
    { revalidateOnFocus: false, revalidateIfStale: false, revalidateOnReconnect: false }
  )
}
