import { Fragment, memo, ReactNode, useCallback, useEffect, useRef } from "react"
import { useVirtualizedList, UseVirtualizedListPropsType } from "@lib/virtualized-list/useVirtualizedList"
import { twMerge, type ClassNameValue } from "@lib/tailwind-merge"
import { Loader } from "@ui/Loader"

export type InstagramSliderProps = {
  renderItem: (index: number, itemHeight: number) => ReactNode
  isLoading: boolean
  slideGapY?: number
  containerPaddingY?: number
  onLastItemShowed?: () => void
  className?: ClassNameValue
} & Omit<UseVirtualizedListPropsType, "getScrollElement">

export const InstagramSlider = memo(function InstagramSlider({
  renderItem,
  isLoading,
  itemHeight,
  itemsCount,
  overScan,
  onLastItemShowed,
  slideGapY,
  containerPaddingY,
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
        "snap-mandatory",
        "snap-y",
        "overflow-y-auto"
      )}
      style={{
        height: `${itemHeight + ((containerPaddingY ?? 0) * 2)}px`,
        scrollPaddingTop: `${containerPaddingY}px`,
        paddingTop: `${containerPaddingY}px`
      }}
    >
      {
        (() => {
          if (isLoading) {
            return (
              <div className={twMerge("w-full h-full flex items-center relative justify-center")}>
                <Loader className={twMerge("absolute top-0 left-0")} />
              </div>
            )
          }

          return (
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
        })()
      }
    </div>
  )
})
