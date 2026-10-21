import { RARITIES } from "@shared/character/leveling"
import { CLASS_TIERS, TIER_LEVELS } from "@shared/character/classes"
import type { CharacterModelType } from "@shared/api/schema/character/generated"
import type { CharacterModel } from "./model"

/** What GET /api/character/generated/model sends: rarity tiers and growth for the /characters page */
export const toPublicCharacterModel = (model: CharacterModel): CharacterModelType => ({
  version: model.version,
  minLevel: model.minLevel,
  maxLevel: model.maxLevel,
  profileMean: model.pokemon.profile.mean,
  growth: model.growth,
  rarities: RARITIES.map((rarity) => {
    const { budget, stat, budgetFactor, baseMultiplier, growthMultiplier } = model.rarities[rarity]

    return {
      rarity,
      budget: { min: budget.min, max: budget.max, mean: budget.mean },
      stat,
      budgetFactor,
      baseMultiplier,
      growthMultiplier
    }
  }),
  tiers: CLASS_TIERS.map(tier => ({ tier, level: TIER_LEVELS[tier] }))
})
