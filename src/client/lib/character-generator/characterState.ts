import type { CharacterModelType, CustomCharacterType } from "@shared/api/schema/character/generated"
import { POKEMON_TYPES } from "@shared/api/schema/pokemon/generated"
import { MAX_LEVEL, MIN_LEVEL, RARITIES, type Rarity } from "@shared/character/leveling"
import { availableClasses, classById } from "@shared/character/classes"
import {
  MAX_TALENTS, MAX_WEAKNESSES, aptitudesOf, type Aptitude, type Skill
} from "@shared/character/skills"
import {
  balancedStats, generatorReducer, initialGeneratorState, remainingOf, tierOf, totalOf,
  type GeneratorAction, type GeneratorModel, type GeneratorState, type Issue, type Stats
} from "@lib/pokemon-generator/generatorState"

// State of the /characters page. A rarity works like a pokemon class of the /generate page (a tier of the budget
// the stat sliders spend), so the budget part reuses the pokemon generator reducer over an adapted model.
// Skills, level and class are on top of it.

export type CharacterModel = CharacterModelType

export const DEFAULT_RARITY: Rarity = 5

export const BASE_CLASS = "commoner"

export const rarityKey = (rarity: Rarity) => `rarity${rarity}`

export const rarityOfKey = (key: string): Rarity => {
  const rarity = Number(key.replace("rarity", ""))

  return (RARITIES as readonly number[]).includes(rarity) ? rarity as Rarity : DEFAULT_RARITY
}

export const stars = (rarity: Rarity) => "★".repeat(rarity)

const zeroStats = { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 }

/** The character model as the pokemon generator state sees it: one class per rarity, no types, abilities or windows */
export const toGeneratorModel = (model: CharacterModel): GeneratorModel => ({
  version: model.version,
  forbiddenBst: [],
  profileMean: model.profileMean,
  classes: model.rarities.map(info => ({
    key: rarityKey(info.rarity),
    // Unused by the reducer; a rarity is not a pokemon class
    class: "single",
    stage: null,
    count: 1,
    bst: info.budget,
    stat: info.stat,
    // Characters have no abilities; [1, 0, 0] keeps the reducer's ability rules out of the way
    abilityCount: [1, 0, 0]
  })),
  types: Object.fromEntries(
    POKEMON_TYPES.map(type => [type, { profileShift: zeroStats, bstShift: 0 }])
  ) as GeneratorModel["types"],
  abilities: [],
  compensation: {}
})

export type CharacterState = {
  // Rarity (as the class key), budget, stats and name
  budget: GeneratorState
  talents: Skill[]
  weaknesses: Skill[]
  level: number
  classId: string
}

export type CharacterAction
  = | { type: "setRarity", rarity: Rarity }
    | { type: "setBudget", budget: number }
    | { type: "setStat", stat: keyof Stats, value: number }
    | { type: "setName", name: string }
    | { type: "applyStats", stats: Stats }
  // normal → talent → weak → normal, skipping a step whose limit is reached
    | { type: "cycleSkill", skill: Skill }
    | { type: "setLevel", level: number }
    | { type: "setClass", classId: string }
  // A whole character, e.g. a random one from the server
    | { type: "load", state: Omit<CharacterState, "budget"> & { rarity: Rarity, stats: Stats } }

export const aptitudeOf = (state: Pick<CharacterState, "talents" | "weaknesses">, skill: Skill): Aptitude => (
  state.talents.includes(skill) ? "talent" : state.weaknesses.includes(skill) ? "weak" : "normal"
)

export const aptitudesOfState = (state: Pick<CharacterState, "talents" | "weaknesses">) => aptitudesOf(
  state.talents,
  state.weaknesses
)

export const openClassesOf = (state: Pick<CharacterState, "talents" | "weaknesses" | "level">) => availableClasses(
  aptitudesOfState(state),
  state.level
)

/** Keeps the class when it is still open, otherwise falls back to the base class */
const settleClass = (state: CharacterState): CharacterState => (openClassesOf(state).some(item => item.id === state.classId)
  ? state
  : { ...state, classId: BASE_CLASS })

const budgetAction = (model: GeneratorModel, state: CharacterState, action: GeneratorAction): CharacterState => ({
  ...state,
  budget: generatorReducer(model, state.budget, action)
})

const nextAptitude = (state: CharacterState, skill: Skill): Aptitude => {
  const order: Aptitude[] = ["normal", "talent", "weak"]
  const current = order.indexOf(aptitudeOf(state, skill))

  for (let step = 1; step < order.length; step++) {
    const next = order[(current + step) % order.length]
    const full = (next === "talent" && state.talents.length >= MAX_TALENTS)
      || (next === "weak" && state.weaknesses.length >= MAX_WEAKNESSES)

    if (!full) {
      return next
    }
  }

  return "normal"
}

export const characterReducer = (model: GeneratorModel, state: CharacterState, action: CharacterAction): CharacterState => {
  switch (action.type) {
    case "setRarity":
      return budgetAction(model, state, { type: "setClass", classKey: rarityKey(action.rarity) })

    case "setBudget":
    case "setStat":
    case "setName":
    case "applyStats":
      return budgetAction(model, state, action)

    case "cycleSkill": {
      const next = nextAptitude(state, action.skill)
      const talents = state.talents.filter(skill => skill !== action.skill)
      const weaknesses = state.weaknesses.filter(skill => skill !== action.skill)

      return settleClass({
        ...state,
        talents: next === "talent" ? [...talents, action.skill] : talents,
        weaknesses: next === "weak" ? [...weaknesses, action.skill] : weaknesses
      })
    }

    case "setLevel":
      return settleClass({ ...state, level: Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(action.level))) })

    case "setClass":
      return openClassesOf(state).some(item => item.id === action.classId) ? { ...state, classId: action.classId } : state

    case "load": {
      const { rarity, stats, ...rest } = action.state
      const budget = generatorReducer(model, state.budget, {
        type: "load",
        state: { classKey: rarityKey(rarity), types: [], abilities: [], stats, name: "" }
      })

      return settleClass({ ...state, ...rest, budget })
    }
  }
}

export const initialCharacterState = (model: GeneratorModel): CharacterState => {
  const start = generatorReducer(model, initialGeneratorState(model), { type: "setClass", classKey: rarityKey(DEFAULT_RARITY) })

  return {
    budget: { ...start, stats: balancedStats(model, start) },
    talents: [],
    weaknesses: [],
    level: MIN_LEVEL,
    classId: BASE_CLASS
  }
}

/** What keeps the character from being saved (errors) and what is merely worth knowing (info) */
export const characterIssuesOf = (model: GeneratorModel, state: CharacterState): Issue[] => {
  const issues: Issue[] = []
  const { budget } = state
  const rarity = rarityOfKey(budget.classKey)
  const tier = tierOf(model, budget.classKey, [])
  const total = totalOf(budget.stats)
  const remaining = remainingOf(budget)

  if (state.talents.length === 0) {
    issues.push({ level: "error", text: "Pick at least one talent" })
  }

  if (total < tier.min) {
    issues.push({
      level: "error",
      text: `BST ${total} is below the ${rarity}★ tier (${tier.min}–${tier.max}): spend ${tier.min - total} more`
    })
  }

  if (remaining > 0 && total >= tier.min) {
    issues.push({ level: "info", text: `${remaining} points unspent: own BST at max level will be ${total}` })
  }

  if (state.classId === BASE_CLASS && openClassesOf(state).length > 2) {
    issues.push({ level: "info", text: `${openClassesOf(state).length - 2} more classes are open at level ${state.level}` })
  }

  return issues
}

export const toCustomCharacter = (state: CharacterState): CustomCharacterType => ({
  rarity: rarityOfKey(state.budget.classKey),
  talents: state.talents,
  weaknesses: state.weaknesses,
  maxStats: state.budget.stats,
  level: state.level,
  class: classById(state.classId)?.id ?? BASE_CLASS,
  ...(state.budget.name && { name: state.budget.name })
})
