import { twMerge } from "@lib/tailwind-merge"
import { memo, useState } from "react"

export type ImgProps = {
  url: string
  alt: string
  width: number
  height: number
  urlThumbnail?: string
  className?: string
}

export const Img = memo(function Img({
  url,
  alt,
  width,
  height,
  className,
  urlThumbnail
}: ImgProps) {
  const [
    loaded,
    setLoaded
  ] = useState(false)

  const [
    error,
    setError
  ] = useState(false)

  return (
    <div
      className={twMerge(
        className,
        "relative",

        "overflow-hidden",

        "flex",
        "items-center",
        "justify-center",

        "w-full",
        "h-full"
      )}
    >
      {!loaded && <div className="animate-pulse absolute z-30 inset-0 bg-white/20" />}
      {error && (
        <div
          className="absolute  w-full h-full flex items-center justify-center bg-neutral-800"
        >
          Ops, image not found :c
        </div>
      )}
      {
        urlThumbnail && !error && (
          <div
            style={{
              backgroundImage: `url(${urlThumbnail})`,
              opacity: "0.3",
              backgroundSize: "300% 300%",
              filter: "blur(10px)"
            }}
            className={twMerge(
              "absolute",

              "top-0",
              "left-0",

              "w-full",
              "h-full",

              "bg-no-repeat",
              "bg-contain",
              "bg-center"
            )}
          />
        )
      }

      <img
        src={`${url}`}
        alt={alt}
        className={twMerge(
          "relative",
          "w-auto h-full",
          "object-contain",
          "z-20",
          "transition-opacity",
          "duration-300",
          loaded ? "opacity-100" : "opacity-0"
        )}
        loading="lazy"
        width={width}
        height={height}
        onError={() => {
          setLoaded(true)
          setError(true)
        }}
        onLoad={() => {
          setLoaded(true)
        }}
      />
    </div>
  )
})
