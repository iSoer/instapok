import { Fragment, memo, ReactNode, useCallback, useEffect, useRef } from "react"
import { useVirtualizedList, UseVirtualizedListPropsType } from "@lib/virtualized-list/useVirtualizedList"
import { twMerge, type ClassNameValue } from "@lib/tailwind-merge"
import { Loader } from "@components/ui/Loader"

export type InstagramSliderProps = {
  renderItem: (index: number, itemHeight: number) => ReactNode
  initialLoading: boolean
  fullScreen?: boolean
  disableSnapMandatory?: boolean
  slideGapY?: number
  containerPaddingY?: number
  onLastItemShowed?: () => void
  className?: ClassNameValue
} & Omit<UseVirtualizedListPropsType, "getScrollElement">

export const InstagramSlider = memo(function InstagramSlider({
  renderItem,
  initialLoading,
  itemHeight,
  disableSnapMandatory,
  itemsCount,
  overScan,
  onLastItemShowed,
  slideGapY,
  containerPaddingY,
  fullScreen,
  className
}: InstagramSliderProps) {
  const parentRef = useRef<HTMLDivElement | null>(null)

  const getScrollElement = useCallback(() => parentRef.current, [])

  const {
    startIndex,
    computedItemHeight,
    totalHeight,
    endIndex,
    getVirtualItems
  } = useVirtualizedList({
    getScrollElement,
    gapY: slideGapY,
    itemHeight: itemHeight,
    overScan: overScan,
    itemsCount: itemsCount
  })

  useEffect(() => {
    if (
      onLastItemShowed
      && endIndex >= itemsCount - 1
    ) {
      onLastItemShowed()
    }
  }, [endIndex, itemsCount, onLastItemShowed])

  return (
    <div
      ref={parentRef}
      className={twMerge(
        className,
        "hide-scrollbar",
        "overflow-y-auto",
        "w-full",
        !disableSnapMandatory && [
          "snap-mandatory",
          "snap-y"
        ],
        fullScreen && "h-dvh"
      )}
      style={{
        ...(!fullScreen && { height: `${itemHeight + ((containerPaddingY ?? 0) * 2)}px` }),
        scrollPaddingTop: `${containerPaddingY}px`,
        paddingTop: `${containerPaddingY}px`
      }}
    >
      {
        initialLoading
          ? (
              <div className={twMerge("w-full h-full flex items-center justify-center")}>
                <Loader />
              </div>
            )
          : (
              <div
                style={{
                  height: `${totalHeight}px`
                }}
              >
                <div
                  style={{
                    transform: `translateY(${computedItemHeight * startIndex}px)`
                  }}
                >
                  {
                    getVirtualItems().map(({ index }) => {
                      return (
                        <Fragment key={index}>
                          <div
                            className={twMerge(
                              "snap-start",
                              "snap-always",
                              "h-fit"
                            )}
                          >
                            {renderItem(index, itemHeight)}
                          </div>
                          {
                            slideGapY && (
                              <div
                                style={{ height: `${slideGapY}px` }}
                              />
                            )
                          }
                        </Fragment>
                      )
                    })
                  }
                </div>
              </div>
            )
      }
    </div>
  )
})
