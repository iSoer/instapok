import useSWRInfinite from "swr/infinite"
import { fetchFn } from "../fetcher"
import {
  ListResponseType,
  ListRequestType
} from "@shared/api/schema/pokemon/list"
import { useCallback } from "react"

export function usePokemonBank({ limit, tags }: ListRequestType) {
  const getKey = useCallback((
    pageIndex: number,
    previousPageData: ListResponseType
  ) => {
    if (previousPageData && previousPageData.data.length < limit) {
      return null
    }

    return {
      url: "/api/pokemon/list",
      page: pageIndex,
      limit
    }
  }, [limit])

  return useSWRInfinite(
    getKey,
    (
      {
        url,
        page,
        limit
      }
    ) => fetchFn<
      ListResponseType,
      ListRequestType
    >(
      {
        payload: {
          page,
          limit,
          tags
        },
        url: url,
        method: "POST"
      }
    )
  )
}
