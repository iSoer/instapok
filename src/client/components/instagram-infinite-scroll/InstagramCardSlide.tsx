import { memo } from "react"
import { twMerge } from "@lib/tailwind-merge"
import { Img } from "../ui/Img"

export type InstagramCardItemType = {
  url: string
  thumbnailUrl: string
  width: number
  height: number
  alt: string | null
  tags?: {
    id: string
    name: string
  }[] | null
}

export type InstagramCardSlidePropsType<T> = {
  itemHeight: number
  itemWidth: number
  item: T
  index?: number
}

export const InstagramCardSlide = memo(function InstagramImageSlide<T extends InstagramCardItemType>({
  itemHeight,
  itemWidth,
  item,
  index
}: InstagramCardSlidePropsType<T>) {
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
        {
          index && (
            <div
              className={twMerge(
                "absolute top-0 left-0 z-30",
                "rounded-br",
                "bg-green-900",
                "px-5",
                "material-shadow",
                "uppercase",
                "text-sm",
                "font-light",
                "text-neutral-200"
              )}
            >
              Index:
              {" "}
              {index}
            </div>
          )
        }
        <div
          className={twMerge(
            "absolute top-0 right-0 z-30",
            "rounded-bl",
            "bg-amber-50",
            "text-neutral-900",
            "px-5",
            "text-sm",
            "font-light",
            "material-shadow"
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
                      "bg-yellow-900",
                      "text-neutral-50",
                      "px-5",
                      "material-shadow",
                      "text-sm",
                      "font-light",
                      "uppercase"
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
          url={item.url}
          urlThumbnail={item.thumbnailUrl}
          alt={`#${item.alt}`}
          width={item.width}
          height={item.height}
        />
      </div>
    </div>
  )
})
