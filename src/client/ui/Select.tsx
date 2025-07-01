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
      <label>
        {label}
        {isLoading
          ? <div>Loading...</div>
          : (
              <select
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

                  "focus:outline-none",
                  "focus:border-blue-500",
                  "focus:ring",
                  "focus:ring-blue-200"
                )}
              >
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
              </select>
            )}

      </label>
    </div>
  )
})
