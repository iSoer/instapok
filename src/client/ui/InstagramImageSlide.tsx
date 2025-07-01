import { memo } from "react"
import { twMerge } from "@lib/tailwind-merge"
import { Img } from "@ui/Img"
import { ListResponseItemType } from "@shared/api/schema/pokemon/list"

export type InstagramImageSlidePropsType = {
  itemHeight: number
  itemWidth: number
  item: ListResponseItemType
  index?: number
}

export const InstagramImageSlide = memo(function InstagramImageSlide({
  itemHeight,
  itemWidth,
  item,
  index
}: InstagramImageSlidePropsType) {
  return (
    <div
      className={twMerge(
        "relative",
        "w-full",
        "flex",
        "justify-center"
      )}
      style={{
        height: `${itemHeight}px`
      }}
    >
      <div
        className={twMerge(
          "relative"
        )}
        style={{
          width: `${itemWidth}px`
        }}
      >
        <div
          className={twMerge(
            "absolute top-0 left-0 z-30",
            "rounded-br",
            "bg-green-700",
            "text-neutral-200",
            "px-5"
          )}
        >
          Index:
          {" "}
          {index}
        </div>
        <div
          className={twMerge(
            "absolute top-0 right-0 z-30",
            "rounded-bl",
            "bg-amber-50",
            "text-neutral-900",
            "px-5"
          )}
        >
          #
          {item.alt}
        </div>
        {
          item.tags && item.tags.length > 0 && (
            <div
              className={twMerge(
                "absolute bottom-0 left-0 z-30",
                "flex flex-row gap-8",
                "mx-10"
              )}
            >
              {
                item.tags.map(tag => (
                  <div
                    key={tag.id}
                    className={twMerge(
                      "rounded-tr rounded-tl",
                      "bg-yellow-600",
                      "text-neutral-50",
                      "px-5"
                    )}
                  >
                    {tag.name}
                  </div>
                ))
              }
            </div>
          )
        }
        <Img
          url={`/assets/pokemon/images/${item.name}.webp`}
          urlThumbnail={`/assets/pokemon/thumbnails/${item.name}.thumbnail.webp`}
          alt={`#${item.alt}`}
          width={item.width}
          height={item.height}
        />
      </div>
    </div>
  )
})
