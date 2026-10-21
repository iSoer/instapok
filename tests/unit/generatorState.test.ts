import { describe, expect, it } from "vitest"
import { buildCustomPokemon } from "@/server/pokemon-model/generate"
import { loadModel } from "@/server/pokemon-model/loadModel"
import { toPublicModel } from "@/server/pokemon-model/publicModel"
import { createRng } from "@/server/pokemon-model/random"
import { POKEMON_TYPES, STATS, generatorModelResponseSchema } from "@shared/api/schema/pokemon/generated"
import {
  abilityPool, canIncrease, generatorReducer, initialGeneratorState, issuesOf, limitsOf, reachableOf, remainingOf, snapBudget,
  tierOf, toCustomPokemon, totalOf, type GeneratorAction, type GeneratorState
} from "@lib/pokemon-generator/generatorState"

const serverModel = loadModel()
// What GET /api/pokemon/generated/model sends
const model = generatorModelResponseSchema.parse({ data: toPublicModel(serverModel) }).data

const run = (actions: GeneratorAction[], state = initialGeneratorState(model)) => actions
  .reduce((current, action) => generatorReducer(model, current, action), state)

const spendAll = (state: GeneratorState) => run(STATS.map(stat => ({ type: "setStat", stat, value: 255 })), state)

describe("budget", () => {
  it("starts inside the tier with the budget spent evenly", () => {
    const state = initialGeneratorState(model)
    const tier = tierOf(model, state.classKey, [])

    expect(state.budget).toBeGreaterThanOrEqual(tier.min)
    expect(state.budget).toBeLessThanOrEqual(tier.max)
    expect(remainingOf(state)).toBeGreaterThanOrEqual(0)
    expect(remainingOf(state)).toBeLessThan(5)
  })

  it("takes every raised point from the budget and blocks raising once it is spent", () => {
    const start = run([{ type: "setStat", stat: "speed", value: 5 }])
    const freed = remainingOf(start)

    expect(freed).toBeGreaterThan(0)

    const raised = run([{ type: "setStat", stat: "attack", value: 255 }], start)

    const attackMax = limitsOf(model, raised.classKey, [], raised.budget).attack.max

    expect(raised.stats.attack).toBe(Math.min(start.stats.attack + Math.floor(freed / 5) * 5, attackMax))
    expect(remainingOf(raised)).toBeLessThan(5)
    expect(canIncrease(model, raised, "defense")).toBe(false)
    // Moving up is refused, the stat stays where it was
    expect(run([{ type: "setStat", stat: "defense", value: raised.stats.defense + 20 }], raised).stats).toEqual(raised.stats)
    // Moving down always works and frees the points again
    const lowered = run([{ type: "setStat", stat: "defense", value: raised.stats.defense - 20 }], raised)

    expect(remainingOf(lowered)).toBe(remainingOf(raised) + 20)
    expect(canIncrease(model, lowered, "hp")).toBe(true)
    expect(reachableOf(model, lowered, "hp")).toBe(lowered.stats.hp + Math.floor(remainingOf(lowered) / 5) * 5)
  })

  it("shrinks the stats when the budget goes down and keeps the budget in the tier", () => {
    const state = spendAll(initialGeneratorState(model))
    const tier = tierOf(model, state.classKey, [])
    const smaller = run([{ type: "setBudget", budget: tier.min }], state)

    expect(smaller.budget).toBe(tier.min)
    expect(totalOf(smaller.stats)).toBeLessThanOrEqual(tier.min)
    expect(run([{ type: "setBudget", budget: 10_000 }], state).budget).toBe(tier.max)
  })

  it("moves the budget out of the forbidden window", () => {
    expect(snapBudget(model, 615, { min: 445, max: 630 })).toBe(600)
    expect(snapBudget(model, 637, { min: 445, max: 720 })).toBe(640)
  })

  it("keeps the budget when switching to a class whose tier contains it, otherwise uses the class mean", () => {
    const state = run([{ type: "setClass", classKey: "legendary" }])
    const legendary = model.classes.find(item => item.key === "legendary")!

    expect(state.budget).toBe(snapBudget(model, legendary.bst.mean, legendary.bst))
    expect(STATS.every(stat => state.stats[stat] >= legendary.stat.min)).toBe(true)
  })
})

describe("types and abilities", () => {
  it("keeps two types at most, the third replacing the second", () => {
    const state = run([
      { type: "toggleType", pokemonType: "fire" },
      { type: "toggleType", pokemonType: "flying" },
      { type: "toggleType", pokemonType: "dragon" }
    ])

    expect(state.types).toEqual(["fire", "dragon"])
    expect(run([{ type: "toggleType", pokemonType: "fire" }], state).types).toEqual(["dragon"])
  })

  it("offers the abilities of the selected types and drops the ones that no longer fit", () => {
    const { byType, universal } = abilityPool(model, ["fire"])

    expect(byType[0].abilities.map(ability => ability.name)).toContain("blaze")
    expect(byType[0].abilities.map(ability => ability.name)).not.toContain("torrent")
    expect(universal.map(ability => ability.name)).toContain("intimidate")

    const state = run([
      { type: "toggleType", pokemonType: "fire" },
      { type: "toggleAbility", ability: "blaze" },
      { type: "toggleAbility", ability: "intimidate" },
      { type: "toggleType", pokemonType: "fire" },
      { type: "toggleType", pokemonType: "water" }
    ])

    // blaze is a fire ability, intimidate is universal
    expect(state.abilities).toEqual(["intimidate"])
  })

  it("allows three abilities at most", () => {
    const state = run(["intimidate", "pressure", "frisk", "unnerve"].map(ability => ({ type: "toggleAbility", ability })))

    expect(state.abilities).toEqual(["intimidate", "pressure", "frisk"])
  })
})

describe("strong abilities bend the limits", () => {
  const water = run([{ type: "toggleType", pokemonType: "water" }])

  it("caps attack with huge-power and shows the doubled attack", () => {
    const state = spendAll(run([
      { type: "setStat", stat: "attack", value: 255 },
      { type: "toggleAbility", ability: "huge-power" }
    ], water))
    const cap = Math.floor((state.budget * 0.12) / 5) * 5

    expect(limitsOf(model, state.classKey, state.abilities, state.budget).attack)
      .toMatchObject({ max: cap, reason: "huge-power" })
    expect(state.stats.attack).toBeLessThanOrEqual(cap)
    expect(model.compensation["huge-power"].statMultiplier).toEqual({ attack: 2 })
  })

  it("fixes HP at 1 with wonder-guard", () => {
    const state = run([{ type: "toggleType", pokemonType: "bug" }, { type: "toggleAbility", ability: "wonder-guard" }])

    expect(state.stats.hp).toBe(1)
    expect(run([{ type: "setStat", stat: "hp", value: 100 }], state).stats.hp).toBe(1)
  })

  it("moves all stats together with imposter", () => {
    const state = run([{ type: "toggleType", pokemonType: "normal" }, { type: "toggleAbility", ability: "imposter" }])

    expect(new Set(STATS.map(stat => state.stats[stat])).size).toBe(1)

    const moved = run([{ type: "setStat", stat: "speed", value: 30 }], state)

    expect(STATS.every(stat => moved.stats[stat] === 30)).toBe(true)
    expect(totalOf(run([{ type: "setStat", stat: "speed", value: 255 }], state).stats)).toBeLessThanOrEqual(state.budget)
  })

  it("widens the tier with truant", () => {
    const state = run([{ type: "toggleType", pokemonType: "normal" }, { type: "toggleAbility", ability: "truant" }])
    const base = tierOf(model, state.classKey, [])

    expect(tierOf(model, state.classKey, state.abilities).max).toBeGreaterThan(base.max)
  })
})

describe("issues", () => {
  it("asks for a type and an ability, and for spending up to the tier", () => {
    const state = run([{ type: "setStat", stat: "hp", value: 5 }, { type: "setStat", stat: "attack", value: 5 }])
    const texts = issuesOf(model, state).filter(issue => issue.level === "error").map(issue => issue.text)

    expect(texts).toContain("Pick at least one type")
    expect(texts).toContain("Pick at least one ability")
    expect(texts.some(text => text.includes("below the"))).toBe(true)
  })
})

describe("random editing sessions", () => {
  // Whatever the user does: the budget holds, the stats stay in their limits, and what the page calls valid the server accepts
  it("keep every invariant", () => {
    const rng = createRng(2024)
    const classKeys = model.classes.map(item => item.key)
    const abilityNames = model.abilities.filter(ability => !ability.formOnly).map(ability => ability.name)
    const typed = (state: GeneratorState) => abilityPool(model, state.types).byType[0]?.abilities ?? []
    let accepted = 0

    for (let session = 0; session < 150; session++) {
      let state = initialGeneratorState(model)

      for (let step = 0; step < 40; step++) {
        const kind = rng.int(0, 9)
        const action: GeneratorAction = kind <= 4
          ? { type: "setStat", stat: STATS[rng.int(0, 5)], value: rng.int(0, 255) }
          : kind === 5
            ? { type: "setBudget", budget: rng.int(150, 750) }
            : kind === 6
              ? { type: "setClass", classKey: classKeys[rng.int(0, classKeys.length - 1)] }
              : kind === 7
                ? { type: "toggleType", pokemonType: POKEMON_TYPES[rng.int(0, POKEMON_TYPES.length - 1)] }
                : { type: "toggleAbility", ability: typed(state)[rng.int(0, 5)]?.name ?? abilityNames[rng.int(0, 20)] }

        state = generatorReducer(model, state, action)

        const limits = limitsOf(model, state.classKey, state.abilities, state.budget)

        expect(totalOf(state.stats)).toBeLessThanOrEqual(state.budget)
        const inLimits = (stat: typeof STATS[number]) => state.stats[stat] >= limits[stat].min
          && state.stats[stat] <= Math.max(limits[stat].max, limits[stat].min)

        expect(STATS.every(inLimits)).toBe(true)
      }

      // Finish like a user would: spend what is left
      state = spendAll(state)

      if (!issuesOf(model, state).some(issue => issue.level === "error")) {
        expect(() => buildCustomPokemon(serverModel, toCustomPokemon(model, state), session)).not.toThrow()
        accepted++
      }
    }

    expect(accepted).toBeGreaterThan(30)
  })
})
