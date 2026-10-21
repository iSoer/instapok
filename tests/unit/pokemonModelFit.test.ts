import { describe, expect, it } from "vitest"
import { fitModel, type FitPokemonRow } from "@/server/pokemon-model/fit"
import committedModel from "@/server/pokemon-model/model.json"
import { pokemonModelSchema } from "@/server/pokemon-model/schema"
import snapshot from "../fixtures/pokemon-info.json"

const stats = (hp: number, attack: number, defense: number, specialAttack: number, specialDefense: number, speed: number) => ({
  hp, attack, defense, specialAttack, specialDefense, speed
})

const row = (externalId: number, name: string, fields: Partial<FitPokemonRow> = {}): FitPokemonRow => ({
  externalId,
  name,
  types: ["fire"],
  abilities: ["blaze"],
  heightDm: 10,
  weightHg: 100,
  baseExperience: null,
  stats: stats(50, 50, 50, 50, 50, 50),
  ...fields
})

const FIRE_ABILITIES = ["blaze", "flash-fire", "solar-power"]

// A line of three (BST 300 → 400 → 520), a single, a legendary and a mega form of the final stage
const ROWS: FitPokemonRow[] = [
  row(1, "emberling", { stats: stats(40, 60, 40, 60, 50, 50), baseExperience: 60, abilities: FIRE_ABILITIES }),
  row(2, "emberoar", { stats: stats(55, 80, 55, 80, 65, 65), baseExperience: 140, abilities: FIRE_ABILITIES }),
  row(3, "infernix", { stats: stats(70, 105, 70, 105, 85, 85), baseExperience: 234, abilities: FIRE_ABILITIES }),
  row(10, "pebblet", {
    types: ["rock", "ground"], abilities: ["sturdy"], stats: stats(50, 70, 100, 30, 50, 20), baseExperience: 112
  }),
  row(20, "titanox", {
    types: ["steel"], abilities: ["pressure"], stats: stats(110, 120, 130, 100, 110, 110), baseExperience: 340
  }),
  row(10001, "infernix-mega", {
    stats: stats(70, 135, 85, 130, 95, 105),
    baseExperience: 274,
    abilities: ["drought"]
  })
]

const ABILITIES = ["blaze", "flash-fire", "solar-power", "sturdy", "pressure", "drought"]

describe("fitModel on a fixed set of rows", () => {
  const model = fitModel(ROWS, ABILITIES, "2026-01-01T00:00:00.000Z")

  it("produces a model that passes its own schema", () => {
    expect(pokemonModelSchema.safeParse(model).error?.issues ?? []).toEqual([])
    expect(model.sourceCounts).toEqual({ pokemon: 5, forms: 1, abilities: 5, lines2: 0, lines3: 1 })
  })

  it("marks the line stages, singles and legendaries", () => {
    expect(model.classes.stage1of3).toMatchObject({ count: 1, bst: { mean: 300, min: 300, max: 300 } })
    expect(model.classes.stage2of3).toMatchObject({ count: 1, bst: { mean: 400 } })
    expect(model.classes.stage3of3).toMatchObject({ count: 1, bst: { mean: 520 } })
    expect(model.classes.single).toMatchObject({ count: 1, bst: { mean: 320 } })
    expect(model.classes.legendary).toMatchObject({ count: 1, bst: { mean: 680 } })
  })

  it("maps base experience to the nearest k of the class", () => {
    expect(model.classes.stage1of3.experience).toEqual([{ value: 0.2, p: 1 }])
    expect(model.classes.stage2of3.experience).toEqual([{ value: 0.35, p: 1 }])
    expect(model.classes.stage3of3.experience).toEqual([{ value: 0.45, p: 1 }])
    expect(model.classes.legendary.experience).toEqual([{ value: 0.5, p: 1 }])
  })

  it("measures the evolution ratios", () => {
    expect(model.evolution.steps["1to2of3"].bstRatio.median).toBeCloseTo(400 / 300, 4)
    expect(model.evolution.steps["2to3of3"].bstRatio.median).toBeCloseTo(520 / 400, 4)
    expect(model.evolution.sameAbilities).toBe(1)
  })

  it("counts ability carriers, types and slots", () => {
    expect(model.abilities.blaze).toMatchObject({ count: 3, types: { fire: 3 }, slots: { first: 3, second: 0, hidden: 0 } })
    expect(model.abilities["solar-power"].slots).toEqual({ first: 0, second: 0, hidden: 3 })
    // Fewer than 8 carriers: no profile shift
    expect(model.abilities.blaze.shift).toBeNull()
    // Forms are not carriers
    expect(model.abilities.drought).toBeUndefined()
  })

  it("derives type frequencies", () => {
    expect(model.types.fire.primary).toBe(0.6)
    expect(model.types.rock).toMatchObject({ primary: 0.2, secondaryP: 1, secondary: { ground: 1 } })
  })

  it("matches the mega form to its base", () => {
    expect(model.forms.mega).toMatchObject({ count: 1, bstDelta: 100, sameTypes: 1, sameAbilities: 0 })
    expect(model.mega.statDelta).toEqual(stats(0, 30, 15, 25, 10, 20))
    expect(model.mega.experienceDelta).toEqual([{ value: 40, p: 1 }])
  })
})

describe("fitModel on the PokeAPI snapshot", () => {
  const model = fitModel(snapshot.pokemon as FitPokemonRow[], snapshot.abilityNames, committedModel.fittedAt)

  it("reproduces the committed model.json", () => {
    expect(model).toEqual(pokemonModelSchema.parse(committedModel))
  })

  // Values quoted in docs/pokemon-model.md
  it("gives the coefficients of the documentation", () => {
    expect(model.sourceCounts).toMatchObject({ pokemon: 1025, forms: 254, lines2: 202, lines3: 80 })

    expect(model.evolution.steps["1to2of2"].bstRatio.median).toBeCloseTo(1.55, 2)
    expect(model.evolution.steps["1to2of3"].bstRatio.median).toBeCloseTo(1.33, 2)
    expect(model.evolution.steps["2to3of3"].bstRatio.median).toBeCloseTo(1.32, 2)
    expect(model.evolution.sameAbilities).toBeCloseTo(0.77, 2)
    expect(model.evolution.profileCorrelation).toBeCloseTo(0.95, 2)

    expect(model.classes.stage1of3.experience).toEqual([{ value: 0.2, p: 1 }])
    expect(model.classes.stage2of3.experience).toEqual([{ value: 0.35, p: 1 }])

    expect(model.types.rock.profileShift.defense).toBeCloseTo(0.066, 3)
    expect(model.types.rock.profileShift.speed).toBeCloseTo(-0.042, 3)
    expect(model.types.dragon.bstShift).toBeCloseTo(77, 0)
    expect(model.types.bug.secondaryP).toBeCloseTo(0.72, 2)

    expect(model.size.weight.slope).toBeCloseTo(1.75, 2)
    expect(model.size.weight.intercept).toBeCloseTo(1.58, 2)

    expect(model.forms.mega).toMatchObject({ count: 48, bstDelta: 100 })
    expect(model.mega.statDelta.hp).toBe(0)
    expect(model.mega.statDelta.attack).toBeCloseTo(28.6, 1)
  })
})
