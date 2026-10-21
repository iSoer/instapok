import { describe, expect, it } from "vitest"
import { buildCustomCharacter } from "@/server/character-model/generate"
import { loadCharacterModel } from "@/server/character-model/model"
import { toPublicCharacterModel } from "@/server/character-model/publicModel"
import { createRng } from "@/server/pokemon-model/random"
import { characterModelResponseSchema } from "@shared/api/schema/character/generated"
import { STATS } from "@shared/api/schema/pokemon/generated"
import { RARITIES } from "@shared/character/leveling"
import { CHARACTER_CLASSES } from "@shared/character/classes"
import { SKILLS } from "@shared/character/skills"
import { limitsOf, remainingOf, tierOf, totalOf } from "@lib/pokemon-generator/generatorState"
import {
  BASE_CLASS, DEFAULT_RARITY, aptitudeOf, characterIssuesOf, characterReducer, initialCharacterState, openClassesOf,
  rarityKey, rarityOfKey, toCustomCharacter, toGeneratorModel, type CharacterAction, type CharacterState
} from "@lib/character-generator/characterState"

const serverModel = loadCharacterModel()
// What GET /api/character/generated/model sends, adapted like the page does
const model = toGeneratorModel(characterModelResponseSchema.parse({ data: toPublicCharacterModel(serverModel) }).data)

const run = (actions: CharacterAction[], state = initialCharacterState(model)) => actions
  .reduce((current, action) => characterReducer(model, current, action), state)

const spendAll = (state: CharacterState) => run(STATS.map(stat => ({ type: "setStat", stat, value: 255 })), state)

describe("rarity as a budget tier", () => {
  it("starts at 5★, level 1, the base class and the budget spent evenly", () => {
    const state = initialCharacterState(model)
    const tier = tierOf(model, state.budget.classKey, [])

    expect(rarityOfKey(state.budget.classKey)).toBe(DEFAULT_RARITY)
    expect(state).toMatchObject({ level: 1, classId: BASE_CLASS, talents: [], weaknesses: [] })
    expect(state.budget.budget).toBeGreaterThanOrEqual(tier.min)
    expect(remainingOf(state.budget)).toBeLessThan(5)
  })

  it("has a tier per rarity matching the server model", () => {
    for (const rarity of RARITIES) {
      const { min, max } = tierOf(model, rarityKey(rarity), [])

      expect({ min, max }).toEqual({ min: serverModel.rarities[rarity].budget.min, max: serverModel.rarities[rarity].budget.max })
    }
  })
})

describe("skills, level and class", () => {
  it("cycles a skill normal → talent → weak → normal and stops at three talents", () => {
    const state = run([{ type: "cycleSkill", skill: "sword" }])

    expect(aptitudeOf(state, "sword")).toBe("talent")
    expect(aptitudeOf(run([{ type: "cycleSkill", skill: "sword" }], state), "sword")).toBe("weak")
    expect(aptitudeOf(run([{ type: "cycleSkill", skill: "sword" }, { type: "cycleSkill", skill: "sword" }], state), "sword"))
      .toBe("normal")

    const three = run(["sword", "axe", "bow", "spear"].map(skill => ({ type: "cycleSkill", skill }) as CharacterAction))

    expect(three.talents).toEqual(["sword", "axe", "bow"])
    // The fourth skips talent and becomes weak
    expect(three.weaknesses).toEqual(["spear"])
  })

  it("only takes an open class and falls back to the base class when it closes", () => {
    const swordsman = run([{ type: "cycleSkill", skill: "sword" }, { type: "setLevel", level: 20 }])

    expect(run([{ type: "setClass", classId: "archer" }], swordsman).classId).toBe(BASE_CLASS)

    const myrmidon = run([{ type: "setClass", classId: "myrmidon" }], swordsman)

    expect(myrmidon.classId).toBe("myrmidon")
    // Dropping the sword talent closes it
    expect(run([{ type: "cycleSkill", skill: "sword" }], myrmidon).classId).toBe(BASE_CLASS)
    expect(run([{ type: "setLevel", level: 10 }], myrmidon).classId).toBe(BASE_CLASS)
  })
})

describe("random editing sessions", () => {
  // Whatever the user does: the budget holds, the class stays open, and what the page calls valid the server accepts
  it("keep every invariant", () => {
    const rng = createRng(2025)
    let accepted = 0

    for (let session = 0; session < 150; session++) {
      let state = initialCharacterState(model)

      for (let step = 0; step < 40; step++) {
        const kind = rng.int(0, 9)
        const open = openClassesOf(state)
        const action: CharacterAction = kind <= 3
          ? { type: "setStat", stat: STATS[rng.int(0, 5)], value: rng.int(0, 255) }
          : kind === 4
            ? { type: "setBudget", budget: rng.int(300, 650) }
            : kind === 5
              ? { type: "setRarity", rarity: RARITIES[rng.int(0, RARITIES.length - 1)] }
              : kind === 6
                ? { type: "cycleSkill", skill: SKILLS[rng.int(0, SKILLS.length - 1)] }
                : kind === 7
                  ? { type: "setLevel", level: rng.int(1, 80) }
                  : { type: "setClass", classId: rng.chance(0.7)
                      ? open[rng.int(0, open.length - 1)].id
                      : CHARACTER_CLASSES[rng.int(0, CHARACTER_CLASSES.length - 1)].id }

        state = characterReducer(model, state, action)

        const limits = limitsOf(model, state.budget.classKey, [], state.budget.budget)

        expect(totalOf(state.budget.stats)).toBeLessThanOrEqual(state.budget.budget)
        expect(STATS.every(stat => state.budget.stats[stat] >= limits[stat].min)).toBe(true)
        expect(openClassesOf(state).some(item => item.id === state.classId)).toBe(true)
      }

      state = spendAll(state)

      if (!characterIssuesOf(model, state).some(issue => issue.level === "error")) {
        expect(() => buildCustomCharacter(serverModel, toCustomCharacter(state), session)).not.toThrow()
        accepted++
      }
    }

    expect(accepted).toBeGreaterThan(30)
  })
})
