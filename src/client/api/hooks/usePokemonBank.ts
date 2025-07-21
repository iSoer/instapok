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
    if (
      previousPageData
      && previousPageData.length < limit
    ) {
      return null
    }

    return urlWithParams("/api/pokemon/list", {
      page: pageIndex,
      limit,
      tags
    })
  }, [limit, tags])

  const swrData = useSWRInfinite(
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
      keepPreviousData: true,
      revalidateFirstPage: false,
      initialSize: 1
    }
  )
  const { data, isLoading, size } = swrData
  return {
    isReachingEnd: Boolean(data?.[data.length - 1] && data?.[data.length - 1].length < limit),
    isLoadingMore: isLoading
      || Boolean(
        size > 0
        && data
        && typeof data[size - 1] === "undefined"
      ),
    ...swrData
  }
}
