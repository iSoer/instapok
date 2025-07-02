import { twMerge } from "tailwind-merge"
import { memo, useCallback, useState, KeyboardEvent } from "react"

type ToggleProps = {
  onToggle: (checked: boolean) => void
  ariaLabel: string
  defaultValue?: boolean
  checked?: boolean
  tabIndex?: number
  className?: string
}

export const Toggle = memo(function Toggle({
  defaultValue,
  onToggle,
  checked,
  className,
  ariaLabel,
  tabIndex = 0
}: ToggleProps) {
  const [
    innerChecked,
    setChecked
  ] = useState(defaultValue)

  const isChecked = checked ?? innerChecked

  const toggle = useCallback(() => {
    const newValue = !isChecked
    setChecked(newValue)
    onToggle(newValue)
  }, [isChecked, onToggle])

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      toggle()
    }
  }, [toggle])

  return (
    <div
      role="switch"
      aria-checked={innerChecked}
      aria-label={ariaLabel}
      tabIndex={tabIndex}

      onClick={() => {
        toggle()
      }}
      onKeyDown={handleKeyDown}
      className={twMerge(
        className,
        "relative w-40 h-20 cursor-pointer outline-none rounded-full",
        "inline-block",
        "focus:ring-2 focus:ring-blue-500"
      )}
    >
      <span
        className={twMerge(
          "toggle-background",
          "absolute inset-0 rounded-full transition duration-300",
          innerChecked ? "bg-green-800 toggle-background-checked" : "bg-neutral-600"
        )}
      >
      </span>
      <span
        className={twMerge(
          "toggle-circle",
          "absolute left-2 bottom-2 w-16 h-16 rounded-full bg-white transition duration-300",
          innerChecked ? "translate-x-20 toggle-circle-checked" : ""
        )}
        aria-label={innerChecked ? "on" : "off"}
      />
    </div>
  )
})
