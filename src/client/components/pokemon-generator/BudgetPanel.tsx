import { memo } from "react"
import { twMerge } from "@lib/tailwind-merge"
import { classLabel, type ClassInfo } from "@lib/pokemon-generator/generatorState"
import { BudgetSlider } from "./BudgetSlider"

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

      <BudgetSlider
        label="Max stats (BST budget)"
        budget={budget}
        tier={tier}
        tierReason={tierReason}
        note={windowText && `No real pokemon has BST ${windowText}`}
        spent={spent}
        onBudgetChange={onBudgetChange}
      />
    </section>
  )
})
