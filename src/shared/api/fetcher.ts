export const fetchFn = async <TResponse, TRequest>({
  payload,
  url,
  method,
  signal
}: {
  url: string
  method: "GET" | "POST" | "DELETE" | "PATCH"
  payload?: TRequest
  signal?: AbortSignal
}) => {
  const response = await fetch(url, {
    signal,
    method,
    headers: {
      ...(
        payload
          ? {
              "content-type": "application/json"
            }
          : undefined
      )
    },
    body: method !== "GET" ? JSON.stringify(payload) : undefined
  })

  if (!response.ok) {
    throw new Error("Network response was not ok")
  }

  return await response.json() as TResponse
}
