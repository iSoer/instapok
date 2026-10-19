// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { usePokemonBank } from "@api/hooks/usePokemonBank"

const fetchMock = vi.fn(async () => Response.json({ data: [], pagination: { count: 0, total: 0 } }))

const requestedUrl = () => new URL(String((fetchMock.mock.calls.at(-1) as unknown[] | undefined)?.[0]))

describe("usePokemonBank", () => {
  beforeEach(() => {
    fetchMock.mockClear()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("sends every tag as a repeated query parameter", async () => {
    renderHook(() => usePokemonBank({ page: 0, limit: 20, tags: ["a-id", "b-id"] }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())

    expect(requestedUrl().pathname).toBe("/api/pokemon/list")
    expect(requestedUrl().searchParams.getAll("tags")).toEqual(["a-id", "b-id"])
    expect(requestedUrl().searchParams.get("page")).toBe("0")
  })

  it("omits tags when nothing is selected", async () => {
    renderHook(() => usePokemonBank({ page: 0, limit: 20, tags: [] }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())

    expect(requestedUrl().searchParams.has("tags")).toBe(false)
  })
})
