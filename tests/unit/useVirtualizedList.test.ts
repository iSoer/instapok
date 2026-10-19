// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useVirtualizedList } from "@lib/virtualized-list/useVirtualizedList"

const ITEM_SIZE = 100
const CONTAINER_SIZE = 500

const createScrollElement = () => {
  const element = document.createElement("div")
  Object.defineProperty(element, "clientHeight", { configurable: true, value: CONTAINER_SIZE })
  Object.defineProperty(element, "clientWidth", { configurable: true, value: CONTAINER_SIZE })

  return element
}

const scrollTo = (element: HTMLElement, scrollTop: number) => {
  act(() => {
    element.scrollTop = scrollTop
    element.dispatchEvent(new Event("scroll"))
  })
}

const setup = (itemsCount = 100, overScan = 2) => {
  const element = createScrollElement()
  const getScrollElement = () => element
  let renders = 0

  const hook = renderHook(
    (props) => {
      renders++

      return useVirtualizedList(props)
    },
    { initialProps: { getScrollElement, itemsCount, itemSize: ITEM_SIZE, overScan } }
  )

  return { element, hook, getRenders: () => renders, getScrollElement }
}

describe("useVirtualizedList", () => {
  it("computes the initial visible range with overscan", () => {
    const { hook } = setup()

    expect(hook.result.current.startIndex).toBe(0)
    // 5 visible items + 2 overscan
    expect(hook.result.current.endIndex).toBe(7)
    expect(hook.result.current.totalSize).toBe(100 * ITEM_SIZE)
    expect(hook.result.current.getVirtualItems().map(item => item.index)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it("positions virtual items by index * itemSize", () => {
    const { hook } = setup()

    expect(hook.result.current.getVirtualItems()[3]).toEqual({ index: 3, start: 3 * ITEM_SIZE })
  })

  it("does not rerender on small scrolls below the threshold", () => {
    const { element, hook, getRenders } = setup()
    const rendersBefore = getRenders()

    scrollTo(element, ITEM_SIZE)

    expect(getRenders()).toBe(rendersBefore)
    expect(hook.result.current.endIndex).toBe(7)
  })

  it("rerenders and shifts the window once the threshold is crossed", () => {
    const { element, hook, getRenders } = setup()
    const rendersBefore = getRenders()

    scrollTo(element, 3 * ITEM_SIZE)

    expect(getRenders()).toBeGreaterThan(rendersBefore)
    expect(hook.result.current.startIndex).toBe(1)
    expect(hook.result.current.endIndex).toBe(10)
  })

  it("never renders past the last item", () => {
    const { element, hook } = setup(10)

    scrollTo(element, 9 * ITEM_SIZE)

    expect(hook.result.current.endIndex).toBeLessThanOrEqual(10)
  })

  it("updates totalSize when items are appended", () => {
    const { hook, getScrollElement } = setup(20)

    hook.rerender({ getScrollElement, itemsCount: 40, itemSize: ITEM_SIZE, overScan: 2 })

    expect(hook.result.current.totalSize).toBe(40 * ITEM_SIZE)
  })
})
