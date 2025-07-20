export type SearchParamsType = Record<string, (string | number)[] | string | number | undefined | null>

export const urlWithParams = (
  baseUrl: string,
  params: SearchParamsType
) => {
  const url = new URL(baseUrl, typeof window !== "undefined" ? window.location.origin : "http://localhost")

  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.toSorted().forEach(v => url.searchParams.append(key, String(v)))
    }
    else {
      url.searchParams.set(key, String(value))
    }
  })

  return url.toString()
}
