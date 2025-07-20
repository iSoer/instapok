import { memo, useCallback, useRef } from "react"
import { InstagramCardItemType, InstagramCardSlide } from "@components/InstagramCardSlide"
import { twMerge } from "@lib/tailwind-merge"

export const InstagramInfiniteScrollSlider = memo(function InstagramInfiniteScrollSlider({
  loading,
  items,
  onLastItemShowed
}: {
  loading: boolean
  items: InstagramCardItemType[]
  onLastItemShowed: () => void
}) {
  const observer = useRef<IntersectionObserver | null>(null)

  const lastSlideRef = useCallback((node: HTMLDivElement) => {
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
  }, [loading, onLastItemShowed])

  return (
    <div
      className={twMerge(
        "hide-scrollbar",
        "overflow-y-auto",
        "w-full",

        "snap-mandatory",
        "snap-y",

        "h-dvh"
      )}
    >
      {
        items.map((item, index) => {
          return (
            <div
              {
                ...(
                  index === items.length - 1
                    ? {
                        ref: lastSlideRef
                      }
                    : {}
                )
              }
              key={item.url}
              className={twMerge(
                "snap-start",
                "snap-always",
                "h-fit"
              )}
            >
              <InstagramCardSlide
                itemHeight={item.height}
                itemWidth={item.width}
                item={item}
              />
            </div>
          )
        })
      }
      {
        loading && <div>Loading...</div>
      }
    </div>
  )
})
