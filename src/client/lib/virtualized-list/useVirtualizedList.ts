"use client"
import {
  useCallback,
  useEffect,
  useReducer,
  useRef
} from "react"

export type UseVirtualizedListPropsType = {
  getScrollElement: () => HTMLElement | null

  itemsCount: number
  itemSize: number
  horizontal?: boolean
  overScan?: number
}

const DEFAULT_OVERSCAN = 2 as const

export const useVirtualizedList = ({
  itemsCount,
  getScrollElement,
  horizontal = false,
  overScan = DEFAULT_OVERSCAN,
  itemSize
}: UseVirtualizedListPropsType) => {
  const rerender = useReducer(() => ({}), {})[1]

  const listConfig = useRef<{
    computedItemSize: number
    startIndex: number
    endIndex: number
    totalSize: number
  }>({
    computedItemSize: 0,
    startIndex: 0,
    endIndex: 0,
    totalSize: 0
  })

  const getElementSizes = useCallback((element: HTMLElement) => {
    const {
      scrollTop,
      clientHeight,
      clientWidth,
      scrollLeft
    } = element

    if (horizontal) {
      return {
        scroll: scrollLeft,
        containerSize: clientWidth
      }
    }

    return {
      scroll: scrollTop,
      containerSize: clientHeight
    }
  }, [horizontal])

  const updateVisibleRange = useCallback((element: HTMLElement) => {
    const {
      scroll,
      containerSize
    } = getElementSizes(element)

    const computedOverScan = Math.max(DEFAULT_OVERSCAN, overScan)

    const computedItemSize = itemSize

    const newStartIndex = Math.max(
      0,
      Math.floor(
        scroll / computedItemSize
      ) - computedOverScan
    )

    const newEndIndex = Math.min(
      itemsCount,
      Math.floor(
        (scroll + containerSize) / computedItemSize
      ) + computedOverScan
    )

    const totalSize = computedItemSize * itemsCount
    let rerenderOverScan = Math.floor((
      overScan * 2 + containerSize / computedItemSize
    ) / 2) - 1

    rerenderOverScan = listConfig.current.endIndex + rerenderOverScan > itemsCount
      ? rerenderOverScan - (listConfig.current.endIndex + rerenderOverScan - itemsCount)
      : rerenderOverScan

    const isRerender
      = listConfig.current.endIndex != newEndIndex
        && (
          newEndIndex >= listConfig.current.endIndex + rerenderOverScan
          || newEndIndex <= listConfig.current.endIndex - rerenderOverScan
        )

    if (
      isRerender
      || listConfig.current.computedItemSize !== computedItemSize
      || listConfig.current.totalSize !== totalSize
    ) {
      listConfig.current.computedItemSize = computedItemSize
      listConfig.current.startIndex = newStartIndex
      listConfig.current.endIndex = newEndIndex
      listConfig.current.totalSize = totalSize

      rerender()
    }
  }, [getElementSizes, itemSize, itemsCount, overScan, rerender])

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
    getScrollElement,
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
          start: i * listConfig.current.computedItemSize
        })
      }
      return ret
    }
  }
}
