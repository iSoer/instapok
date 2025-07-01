"use client"
import { useCallback, useEffect, useReducer, useRef } from "react"

export type UseVirtualizedListPropsType = {
  getScrollElement: () => HTMLElement | null

  itemsCount: number
  itemHeight: number
  overScan?: number
  gapY?: number
}

const DEFAULT_OVERSCAN = 2 as const

export const useVirtualizedList = ({
  itemsCount,
  getScrollElement,
  gapY,
  overScan = DEFAULT_OVERSCAN,
  itemHeight
}: UseVirtualizedListPropsType) => {
  const rerender = useReducer(() => ({}), {})[1]

  const listConfig = useRef<{
    computedItemHeight: number
    startIndex: number
    endIndex: number
    totalHeight: number
  }>({
    computedItemHeight: 0,
    startIndex: 0,
    endIndex: 0,
    totalHeight: 0
  })

  const updateVisibleRange = useCallback((element: HTMLElement) => {
    const {
      scrollTop,
      clientHeight
    } = element

    const computedOverScan = Math.max(DEFAULT_OVERSCAN, overScan)

    const computedItemHeight = itemHeight + (gapY ?? 0)

    const newStartIndex = Math.max(
      0,
      Math.floor(
        scrollTop / computedItemHeight
      ) - computedOverScan
    )

    const newEndIndex = Math.min(
      itemsCount,
      Math.floor(
        (scrollTop + clientHeight) / computedItemHeight
      ) + computedOverScan
    )

    const totalHeight = computedItemHeight * itemsCount

    if (
      listConfig.current.computedItemHeight !== computedItemHeight
      || listConfig.current.startIndex !== newStartIndex
      || listConfig.current.endIndex !== newEndIndex
      || listConfig.current.totalHeight !== totalHeight
    ) {
      listConfig.current.computedItemHeight = computedItemHeight
      listConfig.current.startIndex = newStartIndex
      listConfig.current.endIndex = newEndIndex
      listConfig.current.totalHeight = totalHeight

      rerender()
    }
  }, [gapY, itemHeight, itemsCount, overScan, rerender])

  const onScrollEventCallback = useCallback((event: Event) => {
    const target = event.currentTarget as HTMLElement
    updateVisibleRange(target)
  }, [updateVisibleRange])

  useEffect(() => {
    const element = getScrollElement()

    if (!element) {
      return
    }

    updateVisibleRange(element as HTMLElement)

    element.addEventListener("scroll", onScrollEventCallback)
    element.addEventListener("resize", onScrollEventCallback)
    return () => {
      element.removeEventListener("scroll", onScrollEventCallback)
      element.removeEventListener("resize", onScrollEventCallback)
    }
  }, [
    updateVisibleRange,
    onScrollEventCallback
  ])

  return {
    ...listConfig.current,
    getVirtualItems: () => {
      const ret: {
        index: number
        start: number
      }[] = []
      for (let i = listConfig.current.startIndex; i < listConfig.current.endIndex; i++) {
        ret.push({
          index: i,
          start: i * listConfig.current.computedItemHeight
        })
      }
      return ret
    }
  }
}
