import { memo, useCallback, useState } from "react"
import { twMerge } from "@lib/tailwind-merge"

export type CheckboxGroupPropsType = {
  isLoading?: boolean
  label?: string
  options?: {
    id: string
    name: string
  }[]
  defaultValue?: string[]
  // Receives the selected ids sorted, so the same set always yields the same value
  onChange?: (value: string[]) => void
}

export const CheckboxGroup = memo(function CheckboxGroup({
  isLoading,
  label,
  options,
  defaultValue = [],
  onChange
}: CheckboxGroupPropsType) {
  const [selected, setSelected] = useState(() => new Set(defaultValue))

  const toggle = useCallback((id: string, checked: boolean) => {
    const next = new Set(selected)

    if (checked) {
      next.add(id)
    }
    else {
      next.delete(id)
    }

    setSelected(next)
    onChange?.([...next].sort())
  }, [onChange, selected])

  return (
    <fieldset
      disabled={isLoading}
      className={twMerge(
        "flex flex-col gap-8",
        "disabled:cursor-not-allowed",
        "disabled:opacity-90"
      )}
    >
      <legend
        className={twMerge(
          "mb-8",
          "text-sm",
          "font-light",
          "uppercase"
        )}
      >
        {label}
      </legend>
      {
        isLoading
          ? <div className="text-sm font-light">Loading...</div>
          : options?.map(item => (
              <label
                key={item.id}
                className={twMerge("flex items-center gap-8", "cursor-pointer")}
              >
                <input
                  type="checkbox"
                  value={item.id}
                  checked={selected.has(item.id)}
                  onChange={event => toggle(item.id, event.currentTarget.checked)}
                  className={twMerge("accent-blue-500")}
                />
                {item.name}
              </label>
            ))
      }
    </fieldset>
  )
})
