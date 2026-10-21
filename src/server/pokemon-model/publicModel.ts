import { POKEMON_TYPES, type GeneratorModelType } from "@shared/api/schema/pokemon/generated"
import { classOfKey } from "./classes"
import { COMPENSATION, RANDOM_EXCLUDED_ABILITIES } from "./compensation"
import { CLASS_KEYS, type PokemonModel } from "./schema"

/** What GET /api/pokemon/generated/model sends: limits and pools for the /generate page, without fit internals */
export const toPublicModel = (model: PokemonModel): GeneratorModelType => ({
  version: model.version,
  forbiddenBst: model.forbiddenBst,
  profileMean: model.profile.mean,
  classes: CLASS_KEYS
    .filter(key => model.classes[key].count > 0)
    .map((key) => {
      const { count, bst, stat, abilityCount } = model.classes[key]

      return { key, ...classOfKey(key), count, bst: { min: bst.min, max: bst.max, mean: bst.mean }, stat, abilityCount }
    }),
  types: Object.fromEntries(POKEMON_TYPES.map(type => [type, {
    profileShift: model.types[type].profileShift,
    bstShift: model.types[type].bstShift
  }])) as GeneratorModelType["types"],
  abilities: Object.entries(model.abilities).map(([name, { count, types, shift, universal, meanBst }]) => ({
    name, count, types, shift, universal, meanBst, formOnly: RANDOM_EXCLUDED_ABILITIES.has(name)
  })),
  // restrictedClasses only steers random picks; a hand-made pokemon may take any ability
  compensation: Object.fromEntries(Object.entries(COMPENSATION).map(([name, rule]) => [name, {
    maxShare: rule.maxShare,
    fixedStats: rule.fixedStats,
    equalStats: rule.equalStats,
    bstFactor: rule.bstFactor,
    statMultiplier: rule.statMultiplier,
    note: rule.note
  }]))
})
