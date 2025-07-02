import { ChangeEvent, memo } from "react"
import { twMerge } from "@lib/tailwind-merge"

export type SelectPropsType = {
  isLoading?: boolean
  label?: string
  options?: {
    id: string
    name: string
  }[]
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void
}

export const Select = memo(function Select({ label, options, onChange, isLoading }: SelectPropsType) {
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
        <select
          disabled={isLoading}
          name=""
          onChange={onChange}
          className={twMerge(
            "block",
            "w-full",
            "py-6 px-8",

            "bg-neutral-600",
            "border",
            "border-neutral-500",
            "text-gray-200",

            "disabled:cursor-not-allowed",
            "disabled:opacity-90",

            "focus:outline-none",
            "focus:border-blue-500",
            "focus:ring",
            "focus:ring-blue-200"
          )}
        >
          {
            isLoading
              ? <option value="">Loading...</option>
              : (
                  <>
                    <option value=""></option>
                    {
                      options?.map(item => (
                        <option
                          key={item.id}
                          value={item.id}
                        >
                          {item.name}
                        </option>
                      ))
                    }
                  </>
                )
          }
        </select>
      </label>
    </div>
  )
})
