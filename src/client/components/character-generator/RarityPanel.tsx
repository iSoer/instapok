import { memo } from "react"
import { twMerge } from "@lib/tailwind-merge"
import type { Rarity } from "@shared/character/leveling"
import type { CharacterModel } from "@lib/character-generator/characterState"
import { stars } from "@lib/character-generator/characterState"
import { BudgetSlider } from "../pokemon-generator/BudgetSlider"

export type RarityPanelPropsType = {
  rarities: CharacterModel["rarities"]
  rarity: Rarity
  maxLevel: number
  budget: number
  tier: { min: number, max: number, factor: number }
  // Ability that widened the tier (truant)
  tierReason?: string
  spent: number
  onRarityChange: (rarity: Rarity) => void
  onBudgetChange: (budget: number) => void
}

export const RarityPanel = memo(function RarityPanel({
  rarities,
  rarity,
  maxLevel,
  budget,
  tier,
  tierReason,
  spent,
  onRarityChange,
  onBudgetChange
}: RarityPanelPropsType) {
  const current = rarities.find(item => item.rarity === rarity)

  return (
    <section className="flex flex-col gap-16">
      <div className="flex flex-col gap-8">
        <span id="rarity-label" className="text-sm font-light uppercase">Rarity</span>
        <div role="radiogroup" aria-labelledby="rarity-label" className="flex flex-wrap gap-8">
          {
            rarities.map(item => (
              <button
                key={item.rarity}
                type="button"
                role="radio"
                aria-checked={item.rarity === rarity}
                title={`Budget ${item.budget.min}–${item.budget.max} at level ${maxLevel}`}
                onClick={() => onRarityChange(item.rarity)}
                className={twMerge(
                  "py-6 px-10 rounded-md border text-sm transition-colors",
                  item.rarity === rarity
                    ? "border-amber-400 bg-amber-500/20 text-amber-300"
                    : "border-neutral-700 bg-neutral-900 text-neutral-400 hover:border-neutral-500"
                )}
              >
                {stars(item.rarity)}
              </button>
            ))
          }
        </div>
        {
          current && (
            <span className="text-xs text-neutral-400">
              {`Level 1 ×${current.baseMultiplier}, growth ×${current.growthMultiplier} of 5★: `
                + `budget ×${current.budgetFactor}`}
            </span>
          )
        }
      </div>

      <BudgetSlider
        label={`Stats at level ${maxLevel} (budget)`}
        budget={budget}
        tier={tier}
        tierReason={tierReason}
        spent={spent}
        onBudgetChange={onBudgetChange}
      />
    </section>
  )
})
