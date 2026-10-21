import useSWR from "swr"
import { fetchFn } from "@shared/api/fetcher"
import type { GeneratorModelType } from "@shared/api/schema/pokemon/generated"

/** Limits and ability pools of the generator model; fixed per deployment, so never revalidated */
export function useGeneratorModel() {
  return useSWR(
    "/api/pokemon/generated/model",
    url => fetchFn<{ data: GeneratorModelType }, void>({ url, method: "GET" }),
    { revalidateOnFocus: false, revalidateIfStale: false, revalidateOnReconnect: false }
  )
}
