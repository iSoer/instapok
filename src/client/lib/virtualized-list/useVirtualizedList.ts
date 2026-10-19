"use client"
import {
  useCallback,
  useEffect,
  useRef,
  useState
} from "react"

export type UseVirtualizedListPropsType = {
  getScrollElement: () => HTMLElement | null

  itemsCount: number
  itemSize: number
  horizontal?: boolean
  overScan?: number
}

const DEFAULT_OVERSCAN = 2 as const

type ListConfigType = {
  computedItemSize: number
  startIndex: number
  endIndex: number
  totalSize: number
}

const INITIAL_LIST_CONFIG: ListConfigType = {
  computedItemSize: 0,
  startIndex: 0,
  endIndex: 0,
  totalSize: 0
}

export const useVirtualizedList = ({
  itemsCount,
  getScrollElement,
  horizontal = false,
  overScan = DEFAULT_OVERSCAN,
  itemSize
}: UseVirtualizedListPropsType) => {
  // The ref is the working copy read by scroll handlers; the state is a snapshot for render.
  // The snapshot is only replaced when the range crosses the threshold, so scrolling doesn't rerender.
  const listConfig = useRef<ListConfigType>(INITIAL_LIST_CONFIG)
  const [renderedConfig, setRenderedConfig] = useState<ListConfigType>(INITIAL_LIST_CONFIG)

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
      listConfig.current = {
        computedItemSize,
        startIndex: newStartIndex,
        endIndex: newEndIndex,
        totalSize
      }

      setRenderedConfig(listConfig.current)
    }
  }, [getElementSizes, itemSize, itemsCount, overScan])

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
    ...renderedConfig,
    getVirtualItems: () => {
      const ret: {
        index: number
        start: number
      }[] = []
      for (let i = renderedConfig.startIndex; i < renderedConfig.endIndex; i++) {
        ret.push({
          index: i,
          start: i * renderedConfig.computedItemSize
        })
      }
      return ret
    }
  }
}
