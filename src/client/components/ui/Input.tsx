import { HTMLProps, memo } from "react"
import { twMerge } from "@lib/tailwind-merge"

export type InputPropsType = {
  label?: string
} & HTMLProps<HTMLInputElement>

export const Input = memo(function Input({ className, label, ...rest }: InputPropsType) {
  return (
    <div>
      <label className={twMerge("flex flex-col gap-8")}>
        <div
          className={twMerge(
            "text-sm",
            "font-light",
            "uppercase"
          )}
        >
          {label}
        </div>
        <input
          className={twMerge(
            className,
            "block",
            "w-full",
            "py-6 px-8",

            "bg-neutral-600",
            "border",
            "border-neutral-500",
            "text-gray-200",

            "focus:outline-none",
            "focus:border-blue-500",
            "focus:ring",
            "focus:ring-blue-200"
          )}
          {...rest}
        />
      </label>
    </div>
  )
})
