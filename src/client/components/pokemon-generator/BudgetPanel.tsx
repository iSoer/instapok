import { memo } from "react"
import { twMerge } from "@lib/tailwind-merge"
import { STEP, classLabel, type ClassInfo } from "@lib/pokemon-generator/generatorState"

export type BudgetPanelPropsType = {
  classes: ClassInfo[]
  classKey: string
  budget: number
  tier: { min: number, max: number, factor: number }
  // Ability that widened the tier (truant)
  tierReason?: string
  spent: number
  forbiddenBst: [number, number][]
  onClassChange: (classKey: string) => void
  onBudgetChange: (budget: number) => void
}

export const BudgetPanel = memo(function BudgetPanel({
  classes,
  classKey,
  budget,
  tier,
  tierReason,
  spent,
  forbiddenBst,
  onClassChange,
  onBudgetChange
}: BudgetPanelPropsType) {
  const remaining = budget - spent
  const spentPercent = Math.min(100, (spent / Math.max(budget, 1)) * 100)
  const exhausted = remaining < STEP
  const windowText = forbiddenBst
    .filter(([min, max]) => max >= tier.min && min <= tier.max)
    .map(([min, max]) => `${min}–${max}`)
    .join(", ")

  return (
    <section className="flex flex-col gap-16">
      <label className="flex flex-col gap-8">
        <span className="text-sm font-light uppercase">Class</span>
        <select
          value={classKey}
          onChange={event => onClassChange(event.currentTarget.value)}
          className={twMerge(
            "block w-full py-6 px-8",
            "bg-neutral-600 border border-neutral-500 text-gray-200",
            "focus:outline-none focus:border-blue-500"
          )}
        >
          {
            classes.map(item => (
              <option key={item.key} value={item.key}>
                {`${classLabel(item)} — BST ${item.bst.min}–${item.bst.max}`}
              </option>
            ))
          }
        </select>
      </label>

      <label className="flex flex-col gap-8">
        <span className="flex items-baseline justify-between">
          <span className="text-sm font-light uppercase">Max stats (BST budget)</span>
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
          {windowText && <span>{`No real pokemon has BST ${windowText}`}</span>}
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
    </section>
  )
})
