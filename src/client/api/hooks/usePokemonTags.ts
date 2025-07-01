import { fetchFn } from "../fetcher"
import useSWR from "swr"
import { ListResponseType } from "@shared/api/schema/pokemon/tags"

export function usePokemonTags() {
  return useSWR(
    "/api/pokemon/tags",
    (url) => {
      return fetchFn<ListResponseType, void>({
        url,
        method: "POST"
      })
    }
  )
}
