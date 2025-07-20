import useSWRInfinite from "swr/infinite"
import { fetchFn } from "@shared/api/fetcher"
import {
  ListResponseType,
  ListRequestType
} from "@shared/api/schema/pokemon/list"
import { useCallback } from "react"
import { urlWithParams } from "@api/helpers/urlWithParams"

export function usePokemonBank({ limit, tags }: ListRequestType) {
  const getKey = useCallback((
    pageIndex: number,
    previousPageData: ListResponseType
  ) => {
    if (previousPageData && previousPageData.data.length < limit) {
      return null
    }

    return urlWithParams("/api/pokemon/list", {
      page: pageIndex,
      limit,
      tags
    })
  }, [limit, tags])

  return useSWRInfinite(
    getKey,
    url => fetchFn<
      ListResponseType,
      ListRequestType
    >(
      {
        url: url,
        method: "GET"
      }
    ),
    {
      revalidateFirstPage: false
    }
  )
}
