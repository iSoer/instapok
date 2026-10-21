import useSWR from "swr"
import { fetchFn } from "@shared/api/fetcher"
import type { z } from "zod"
import type { generatedListResponseSchema } from "@shared/api/schema/pokemon/generated"

export const RECENT_GENERATED_URL = "/api/pokemon/generated?page=0&limit=8&order=desc"

/** The newest saved generated pokemon */
export function useRecentGeneratedPokemon() {
  return useSWR(
    RECENT_GENERATED_URL,
    url => fetchFn<z.infer<typeof generatedListResponseSchema>, void>({ url, method: "GET" })
  )
}
