import { twMerge } from "@lib/tailwind-merge"
import { memo } from "react"
import { type ClassNameValue } from "@lib/tailwind-merge"

export const Loader = memo(function Loader({ className }: { className: ClassNameValue }) {
  return (
    <div
      className={twMerge(
        className,
        "animate-spin",
        "bg-[url(/assets/pokeball.webp)]",
        "bg-center",
        "bg-contain",
        "w-30 h-30",
        "m-10"
      )}
    />
  )
})
