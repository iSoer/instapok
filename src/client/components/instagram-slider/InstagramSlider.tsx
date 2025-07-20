import { Fragment, memo, ReactNode, useCallback, useEffect, useRef } from "react"
import { useVirtualizedList, UseVirtualizedListPropsType } from "@lib/virtualized-list/useVirtualizedList"
import { twMerge, type ClassNameValue } from "@lib/tailwind-merge"
import { Loader } from "@components/ui/Loader"

export type InstagramSliderProps = {
  renderItem: (index: number, itemHeight: number) => ReactNode
  initialLoading: boolean
  fullScreen?: boolean
  disableSnapMandatory?: boolean
  slideGap?: number
  containerPaddingY?: number
  onLastItemShowed?: () => void
  className?: ClassNameValue
} & Omit<UseVirtualizedListPropsType, "getScrollElement">

export const InstagramSlider = memo(function InstagramSlider({
  renderItem,
  initialLoading,
  itemSize,
  disableSnapMandatory,
  itemsCount,
  overScan,
  onLastItemShowed,
  slideGap,
  containerPaddingY,
  fullScreen,
  className
}: InstagramSliderProps) {
  const parentRef = useRef<HTMLDivElement | null>(null)

  const getScrollElement = useCallback(() => parentRef.current, [])

  const {
    startIndex,
    computedItemSize,
    totalSize,
    endIndex,
    getVirtualItems
  } = useVirtualizedList({
    getScrollElement,
    itemSize: itemSize + (slideGap ?? 0),
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
        ...(!fullScreen && {
          height: `${itemSize + ((containerPaddingY ?? 0) * 2)}px`
        }),
        scrollPaddingTop: `${containerPaddingY ?? 0}px`,
        paddingTop: `${containerPaddingY ?? 0}px`
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
                  height: `${totalSize}px`
                }}
              >
                <div
                  style={{
                    transform: `translateY(${computedItemSize * startIndex}px)`
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
                            {renderItem(index, itemSize)}
                          </div>
                          {
                            slideGap && (
                              <div
                                style={{ height: `${slideGap}px` }}
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
