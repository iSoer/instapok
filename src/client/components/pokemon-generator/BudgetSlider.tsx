import { memo, type ReactNode } from "react"
import { twMerge } from "@lib/tailwind-merge"
import { STEP } from "@lib/pokemon-generator/generatorState"

export type BudgetSliderPropsType = {
  label: string
  budget: number
  tier: { min: number, max: number, factor: number }
  // Ability that widened the tier (truant)
  tierReason?: string
  // Shown on the right under the slider
  note?: ReactNode
  spent: number
  onBudgetChange: (budget: number) => void
}

/** The budget slider inside its tier and how much of the budget the stats have spent */
export const BudgetSlider = memo(function BudgetSlider({
  label,
  budget,
  tier,
  tierReason,
  note,
  spent,
  onBudgetChange
}: BudgetSliderPropsType) {
  const remaining = budget - spent
  const spentPercent = Math.min(100, (spent / Math.max(budget, 1)) * 100)
  const exhausted = remaining < STEP

  return (
    <>
      <label className="flex flex-col gap-8">
        <span className="flex items-baseline justify-between">
          <span className="text-sm font-light uppercase">{label}</span>
          <span className="text-2xl tabular-nums">{budget}</span>
        </span>
        <input
          type="range"
          className="stat-range"
          min={tier.min}
          max={tier.max}
          step={STEP}
          value={budget}
          style={{ background: "#404040" }}
          onChange={event => onBudgetChange(Number(event.currentTarget.value))}
        />
        <span className="flex justify-between text-xs text-neutral-400">
          <span>
            {`Tier ${tier.min}–${tier.max}`}
            {tier.factor !== 1 && ` (×${tier.factor} by ${tierReason})`}
          </span>
          {note && <span>{note}</span>}
        </span>
      </label>

      <div className="flex flex-col gap-6" aria-live="polite">
        <div className="flex justify-between text-sm">
          <span>{`Spent ${spent}`}</span>
          <span className={twMerge("tabular-nums", exhausted ? "text-red-400" : "text-green-400")}>
            {`Remaining ${remaining}`}
          </span>
        </div>
        <div className="h-10 w-full overflow-hidden rounded-full bg-neutral-800">
          <div
            className={twMerge("h-full transition-[width] duration-150", exhausted ? "bg-red-500" : "bg-green-500")}
            style={{ width: `${spentPercent}%` }}
          />
        </div>
      </div>
    </>
  )
})
