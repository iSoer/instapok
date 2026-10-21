import useSWR from "swr"
import { fetchFn } from "@shared/api/fetcher"
import type { z } from "zod"
import type { generatedCharacterListResponseSchema } from "@shared/api/schema/character/generated"

export const RECENT_CHARACTERS_URL = "/api/character/generated?page=0&limit=8&order=desc"

/** The newest saved generated characters */
export function useRecentGeneratedCharacters() {
  return useSWR(
    RECENT_CHARACTERS_URL,
    url => fetchFn<z.infer<typeof generatedCharacterListResponseSchema>, void>({ url, method: "GET" })
  )
}
