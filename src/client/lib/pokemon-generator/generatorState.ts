import {
  STATS, type CustomPokemonType, type GeneratorModelType, type PokemonType, type Stat
} from "@shared/api/schema/pokemon/generated"

// State of the /generate page: a stat budget (BST) the six stat sliders spend from

export type Stats = Record<Stat, number>

export type GeneratorModel = GeneratorModelType

export type ClassInfo = GeneratorModel["classes"][number]

export type ModelAbility = GeneratorModel["abilities"][number]

export type GeneratorState = {
  classKey: string
  // Max stats of the pokemon: the sum the sliders may spend
  budget: number
  // Primary type first
  types: PokemonType[]
  // Slot order: slot 1, slot 2, hidden
  abilities: string[]
  stats: Stats
  name: string
}

export type GeneratorAction
  = | { type: "setClass", classKey: string }
    | { type: "setBudget", budget: number }
    | { type: "setStat", stat: Stat, value: number }
    | { type: "toggleType", pokemonType: PokemonType }
    | { type: "toggleAbility", ability: string }
  // Stats computed elsewhere (the server's distribution); the budget grows to fit them if needed
    | { type: "applyStats", stats: Stats }
  // A whole pokemon, e.g. a random one from the server
    | { type: "load", state: Omit<GeneratorState, "budget"> }
    | { type: "setName", name: string }

export const STEP = 5
export const MAX_TYPES = 2
export const MAX_ABILITIES = 3

export type StatLimit = {
  min: number
  max: number
  // Fixed by an ability rule, the slider does not move
  locked: boolean
  // Ability that lowered the max (huge-power) or fixed the value (wonder-guard)
  reason?: string
}

export type StatLimits = Record<Stat, StatLimit>

const floor5 = (value: number) => Math.floor(value / STEP) * STEP

const ceil5 = (value: number) => Math.ceil(value / STEP) * STEP

const round5 = (value: number) => Math.round(value / STEP) * STEP

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const mapStats = (fn: (stat: Stat) => number): Stats => Object.fromEntries(STATS.map(stat => [stat, fn(stat)])) as Stats

export const totalOf = (stats: Stats) => STATS.reduce((sum, stat) => sum + stats[stat], 0)

export const remainingOf = (state: GeneratorState) => state.budget - totalOf(state.stats)

export const classInfoOf = (model: GeneratorModel, classKey: string) => model.classes.find(item => item.key === classKey)
  ?? model.classes[0]

export const classLabel = ({ class: pokemonClass, stage }: Pick<ClassInfo, "class" | "stage">) => {
  if (stage) {
    return `Stage ${stage.index} of ${stage.of}`
  }

  return {
    stage: "Stage",
    single: "Single",
    semiLegendary: "Semi-legendary",
    pseudoLegendary: "Pseudo-legendary",
    legendary: "Legendary"
  }[pokemonClass]
}

/** Budget-bending abilities among the selected ones (huge-power, wonder-guard, truant…) */
export const rulesOf = (model: GeneratorModel, abilities: string[]) => abilities
  .filter(ability => model.compensation[ability])
  .map(ability => ({ ability, rule: model.compensation[ability] }))

/** Ability that makes all stats equal (imposter), if selected */
export const equalStatsAbility = (model: GeneratorModel, abilities: string[]) => rulesOf(model, abilities)
  .find(({ rule }) => rule.equalStats)?.ability

/** BST tier of the class, widened by abilities like truant; the server validates against the same range */
export const tierOf = (model: GeneratorModel, classKey: string, abilities: string[]) => {
  const { bst } = classInfoOf(model, classKey)
  const factor = Math.max(1, ...rulesOf(model, abilities).map(({ rule }) => rule.bstFactor ?? 1))

  return {
    min: bst.min,
    max: factor === 1 ? bst.max : Math.min(720, ceil5(bst.max * factor)),
    factor
  }
}

export const isForbiddenBst = (model: GeneratorModel, bst: number) => model.forbiddenBst
  .some(([min, max]) => bst >= min && bst <= max)

/** Budget rounded to 5, inside the tier and outside forbidden windows */
export const snapBudget = (model: GeneratorModel, value: number, tier: { min: number, max: number }) => {
  let budget = clamp(round5(value), ceil5(tier.min), floor5(tier.max))

  for (const [min, max] of model.forbiddenBst) {
    if (budget >= min && budget <= max) {
      const edges = [floor5(min - 1), ceil5(max + 1)].filter(edge => edge >= tier.min && edge <= tier.max)

      budget = edges.sort((a, b) => Math.abs(a - budget) - Math.abs(b - budget))[0] ?? budget
    }
  }

  return budget
}

/** Range of every slider: the class stat range, narrowed or fixed by the abilities' rules */
export const limitsOf = (model: GeneratorModel, classKey: string, abilities: string[], budget: number): StatLimits => {
  const { stat } = classInfoOf(model, classKey)
  const limits = Object.fromEntries(STATS.map(name => [name, { min: stat.min, max: stat.max, locked: false }])) as StatLimits

  for (const { ability, rule } of rulesOf(model, abilities)) {
    for (const [name, share] of Object.entries(rule.maxShare ?? {}) as [Stat, number][]) {
      const max = Math.max(limits[name].min, floor5(budget * share))

      if (max < limits[name].max) {
        limits[name] = { ...limits[name], max, reason: ability }
      }
    }

    for (const [name, value] of Object.entries(rule.fixedStats ?? {}) as [Stat, number][]) {
      limits[name] = { min: value, max: value, locked: true, reason: ability }
    }
  }

  return limits
}

const limitsOfState = (model: GeneratorModel, state: GeneratorState) => limitsOf(
  model,
  state.classKey,
  state.abilities,
  state.budget
)

/** Value of one equal stat under imposter: as much of the budget as fits six times */
const equalValue = (state: GeneratorState, limits: StatLimits) => {
  const free = STATS.filter(stat => !limits[stat].locked)
  const fixedSum = STATS.filter(stat => limits[stat].locked).reduce((sum, stat) => sum + limits[stat].min, 0)
  const min = Math.max(...free.map(stat => limits[stat].min))
  const max = Math.min(...free.map(stat => limits[stat].max))

  return clamp(floor5((state.budget - fixedSum) / Math.max(free.length, 1)), min, max)
}

/** Highest value the slider can reach now: its max, or less when the budget is spent */
export const reachableOf = (model: GeneratorModel, state: GeneratorState, stat: Stat, limits = limitsOfState(model, state)) => {
  const limit = limits[stat]

  if (limit.locked) {
    return limit.min
  }

  if (equalStatsAbility(model, state.abilities)) {
    return equalValue(state, limits)
  }

  return clamp(state.stats[stat] + floor5(Math.max(remainingOf(state), 0)), limit.min, Math.max(limit.max, limit.min))
}

/** The slider may move up: not locked, below its max and the budget is not spent */
export const canIncrease = (model: GeneratorModel, state: GeneratorState, stat: Stat) => reachableOf(model, state, stat)
  > state.stats[stat]

/** Brings the stats back inside the limits and the budget: fixes, equalizes, then trims the largest stats */
export const fitStats = (model: GeneratorModel, state: GeneratorState): GeneratorState => {
  const limits = limitsOfState(model, state)

  if (equalStatsAbility(model, state.abilities)) {
    const value = equalValue(state, limits)

    return { ...state, stats: mapStats(stat => (limits[stat].locked ? limits[stat].min : value)) }
  }

  const stats = mapStats(stat => (limits[stat].locked
    ? limits[stat].min
    : clamp(round5(state.stats[stat]), limits[stat].min, limits[stat].max)))

  for (let guard = 0; totalOf(stats) > state.budget && guard < 1000; guard++) {
    const reducible = STATS.filter(stat => !limits[stat].locked && stats[stat] - STEP >= limits[stat].min)

    if (reducible.length === 0) {
      break
    }

    const slack = (stat: Stat) => stats[stat] - limits[stat].min
    const largest = reducible.reduce((best, stat) => (slack(stat) > slack(best) ? stat : best))

    stats[largest] -= STEP
  }

  return { ...state, stats }
}

/** The budget split evenly, rounded to 5, within the limits */
export const balancedStats = (model: GeneratorModel, state: GeneratorState): Stats => {
  const limits = limitsOfState(model, state)
  const stats = mapStats(stat => (limits[stat].locked
    ? limits[stat].min
    : clamp(floor5(state.budget / 6), limits[stat].min, limits[stat].max)))

  for (let i = 0; totalOf(stats) + STEP <= state.budget && i < 1000; i++) {
    const stat = STATS[i % STATS.length]

    if (!limits[stat].locked && stats[stat] + STEP <= limits[stat].max) {
      stats[stat] += STEP
    }
  }

  return fitStats(model, { ...state, stats }).stats
}

/** Abilities typical for the types (carriers of that type exist) and universal ones; form-change mechanics are left out */
export const abilityPool = (model: GeneratorModel, types: PokemonType[]) => {
  const available = model.abilities.filter(ability => !ability.formOnly)
  const byType = types.map(type => ({
    type,
    abilities: available
      .filter(ability => (ability.types[type] ?? 0) > 0 && !ability.universal)
      .sort((a, b) => (b.types[type] ?? 0) - (a.types[type] ?? 0) || a.name.localeCompare(b.name))
  }))
  const universal = available
    .filter(ability => ability.universal)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

  return { byType, universal }
}

export const matchesTypes = (ability: ModelAbility | undefined, types: PokemonType[]) => ability !== undefined
  && !ability.formOnly
  && (ability.universal || types.some(type => (ability.types[type] ?? 0) > 0))

/** Ability counts real pokemon of the class have */
export const allowedAbilityCounts = (model: GeneratorModel, classKey: string) => [1, 2, 3]
  .filter(count => classInfoOf(model, classKey).abilityCount[count - 1] > 0)

/** Keeps the budget inside the (possibly changed) tier, then the stats inside the budget */
const settle = (model: GeneratorModel, state: GeneratorState) => fitStats(model, {
  ...state,
  budget: snapBudget(model, state.budget, tierOf(model, state.classKey, state.abilities))
})

export const generatorReducer = (model: GeneratorModel, state: GeneratorState, action: GeneratorAction): GeneratorState => {
  switch (action.type) {
    case "setClass": {
      const tier = tierOf(model, action.classKey, state.abilities)
      const keep = state.budget >= tier.min && state.budget <= tier.max

      return settle(model, {
        ...state,
        classKey: action.classKey,
        budget: keep ? state.budget : classInfoOf(model, action.classKey).bst.mean
      })
    }

    case "setBudget":
      return settle(model, { ...state, budget: action.budget })

    case "setStat": {
      const limits = limitsOfState(model, state)

      if (limits[action.stat].locked) {
        return state
      }

      if (equalStatsAbility(model, state.abilities)) {
        // All stats move together, so the whole budget is the limit
        const value = clamp(round5(action.value), limits[action.stat].min, equalValue(state, limits))

        return { ...state, stats: mapStats(stat => (limits[stat].locked ? limits[stat].min : value)) }
      }

      // Moving up is cut at what the remaining budget allows; moving down always works and frees points
      const value = clamp(round5(action.value), limits[action.stat].min, reachableOf(model, state, action.stat, limits))

      return value === state.stats[action.stat] ? state : { ...state, stats: { ...state.stats, [action.stat]: value } }
    }

    case "toggleType": {
      const selected = state.types.includes(action.pokemonType)
      const types = selected
        ? state.types.filter(type => type !== action.pokemonType)
        // A third type replaces the secondary one
        : [...state.types.slice(0, MAX_TYPES - 1), action.pokemonType]
      const byName = new Map(model.abilities.map(ability => [ability.name, ability]))
      const abilities = state.abilities.filter(name => matchesTypes(byName.get(name), types))

      return settle(model, { ...state, types, abilities })
    }

    case "toggleAbility": {
      const selected = state.abilities.includes(action.ability)

      if (!selected && state.abilities.length >= MAX_ABILITIES) {
        return state
      }

      const abilities = selected
        ? state.abilities.filter(name => name !== action.ability)
        : [...state.abilities, action.ability]

      return settle(model, { ...state, abilities })
    }

    case "applyStats": {
      const tier = tierOf(model, state.classKey, state.abilities)
      const budget = snapBudget(model, Math.max(state.budget, ceil5(totalOf(action.stats))), tier)

      return fitStats(model, { ...state, budget, stats: action.stats })
    }

    case "load": {
      const tier = tierOf(model, action.state.classKey, action.state.abilities)

      return fitStats(model, { ...action.state, budget: snapBudget(model, ceil5(totalOf(action.state.stats)), tier) })
    }

    case "setName":
      return { ...state, name: action.name }
  }
}

export const initialGeneratorState = (model: GeneratorModel): GeneratorState => {
  const info = model.classes.find(item => item.key === "stage3of3") ?? model.classes[0]
  const state: GeneratorState = {
    classKey: info.key,
    budget: snapBudget(model, info.bst.mean, tierOf(model, info.key, [])),
    types: [],
    abilities: [],
    stats: mapStats(() => 0),
    name: ""
  }

  return { ...state, stats: balancedStats(model, state) }
}

export type Issue = { level: "error" | "info", text: string }

/** What keeps the pokemon from being saved (errors) and what is merely worth knowing (info) */
export const issuesOf = (model: GeneratorModel, state: GeneratorState): Issue[] => {
  const issues: Issue[] = []
  const info = classInfoOf(model, state.classKey)
  const tier = tierOf(model, state.classKey, state.abilities)
  const total = totalOf(state.stats)
  const remaining = remainingOf(state)

  if (state.types.length === 0) {
    issues.push({ level: "error", text: "Pick at least one type" })
  }

  if (state.abilities.length === 0) {
    issues.push({ level: "error", text: "Pick at least one ability" })
  }
  else if (!allowedAbilityCounts(model, state.classKey).includes(state.abilities.length)) {
    issues.push({ level: "error", text: `${classLabel(info)} pokemon never have ${state.abilities.length} abilities` })
  }

  if (total < tier.min) {
    issues.push({
      level: "error",
      text: `BST ${total} is below the ${classLabel(info)} tier (${tier.min}–${tier.max}): spend ${tier.min - total} more`
    })
  }

  if (isForbiddenBst(model, total)) {
    issues.push({ level: "error", text: `BST ${total} is in a range no real pokemon has` })
  }

  if (remaining > 0 && total >= tier.min) {
    issues.push({ level: "info", text: `${remaining} points unspent: BST will be ${total}` })
  }

  return issues
}

export const toCustomPokemon = (model: GeneratorModel, state: GeneratorState): CustomPokemonType => {
  const info = classInfoOf(model, state.classKey)

  return {
    class: info.class,
    ...(info.stage && { stage: info.stage }),
    types: state.types,
    abilities: state.abilities,
    stats: state.stats,
    ...(state.name && { name: state.name })
  }
}

export const classKeyOfPokemon = (model: GeneratorModel, pokemon: Pick<ClassInfo, "class" | "stage">) => model.classes
  .find(item => item.class === pokemon.class
    && item.stage?.index === pokemon.stage?.index
    && item.stage?.of === pokemon.stage?.of)
  ?.key
