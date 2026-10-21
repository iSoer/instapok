import { fetchFn } from "@shared/api/fetcher"
import useSWR from "swr"
import { AbilitiesResponseType } from "@shared/api/schema/pokemon/abilities"

export function usePokemonAbilities() {
  return useSWR(
    "/api/pokemon/abilities",
    (url) => {
      return fetchFn<AbilitiesResponseType, void>({
        url,
        method: "GET"
      })
    }
  )
}
