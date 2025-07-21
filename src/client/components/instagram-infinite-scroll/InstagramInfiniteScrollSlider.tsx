import {
  memo,
  useCallback,
  useRef,
  useImperativeHandle,
  forwardRef
} from "react"
import { InstagramCardItemType, InstagramCardSlide } from "./InstagramCardSlide"
import { twMerge } from "@lib/tailwind-merge"
import { Loader } from "@components/ui/Loader"

export type InstagramInfiniteScrollSliderForwardRefType = {
  scrollToTop: () => void
}

export type InstagramInfiniteScrollSliderPropsType = {
  loading: boolean
  isReachingEnd: boolean
  items: InstagramCardItemType[]
  onLastItemShowed: () => void
}

export const InstagramInfiniteScrollSlider = memo(
  forwardRef<
    InstagramInfiniteScrollSliderForwardRefType,
    InstagramInfiniteScrollSliderPropsType
  >(function InstagramInfiniteScrollSlider(
    {
      loading,
      items,
      onLastItemShowed,
      isReachingEnd
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null)
    const observer = useRef<IntersectionObserver | null>(null)

    useImperativeHandle(ref, () => ({
      scrollToTop: () => {
        containerRef.current?.scrollTo({ top: 0 })
      }
    }))

    const lastSlideRef = useCallback(
      (node: HTMLDivElement) => {
        if (loading) {
          return
        }

        if (observer.current) {
          observer.current.disconnect()
        }

        observer.current = new IntersectionObserver((entries) => {
          if (entries[0].isIntersecting) {
            onLastItemShowed()
          }
        })

        if (node) {
          observer.current.observe(node)
        }
      },
      [loading, onLastItemShowed]
    )

    return (
      <div className="relative">
        <div className="absolute left-20 top-20">
          Items:
          {" "}
          {items.length}
        </div>

        <div
          ref={containerRef}
          className={twMerge(
            "hide-scrollbar",
            "overflow-y-auto",
            "w-full",
            "snap-mandatory",
            "snap-y",
            "scroll-p-40",
            "h-dvh",
            "flex flex-col gap-y-20",
            "pt-20"
          )}
        >
          {items.map((item, index) => (
            <div
              key={item.url}
              ref={
                index === items.length - 1
                && !isReachingEnd
                  ? lastSlideRef
                  : undefined
              }
              className={twMerge("snap-start", "snap-always", "h-fit")}
            >
              <InstagramCardSlide
                itemHeight={item.height}
                itemWidth={item.width}
                item={item}
              />
            </div>
          ))}
          {loading && (
            <div className="mx-auto">
              <Loader />
            </div>
          )}
          {isReachingEnd && (
            <div
              className={twMerge("snap-start", "snap-always", "text-center", "p-20")}
            >
              Data has ended
            </div>
          )}
        </div>
      </div>
    )
  }))
