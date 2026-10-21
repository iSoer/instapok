import { describe, expect, it } from "vitest"
import { classKeyOf } from "@/server/pokemon-model/classes"
import {
  GenerateRequestError, buildCustomPokemon, canHaveMega, generateEvolutionLine, generateMegaForm, generatePokemon,
  type GeneratedPokemon
} from "@/server/pokemon-model/generate"
import { loadModel } from "@/server/pokemon-model/loadModel"
import { correlation, median, sum, toShares, toVector } from "@/server/pokemon-model/math"
import { profileCorrelation, validateLine, validatePokemon } from "@/server/pokemon-model/validate"
import { STATS, generateRequestSchema, type GenerateRequestType } from "@shared/api/schema/pokemon/generated"

const model = loadModel()

const seeds = (count: number, from = 1) => Array.from({ length: count }, (_, i) => from + i)

const generateMany = (count: number, request: GenerateRequestType = {}) => seeds(count)
  .map(seed => generatePokemon(model, request, seed))

const bstOf = (pokemon: GeneratedPokemon) => sum(toVector(pokemon.stats))

const meanShare = (pokemon: GeneratedPokemon[], stat: typeof STATS[number]) => {
  const j = STATS.indexOf(stat)

  return sum(pokemon.map(item => toShares(toVector(item.stats))[j])) / pokemon.length
}

const violationsOf = (run: () => unknown) => {
  try {
    run()
  }
  catch (error) {
    if (error instanceof GenerateRequestError) {
      return error.violations
    }

    throw error
  }

  return []
}

describe("determinism", () => {
  it("gives the same pokemon for the same seed and different ones for different seeds", () => {
    expect(JSON.stringify(generatePokemon(model, {}, 42))).toBe(JSON.stringify(generatePokemon(model, {}, 42)))
    expect(JSON.stringify(generateEvolutionLine(model, { length: 3 }, 7)))
      .toBe(JSON.stringify(generateEvolutionLine(model, { length: 3 }, 7)))

    const names = new Set(seeds(50).map(seed => generatePokemon(model, {}, seed).name))

    expect(names.size).toBeGreaterThan(45)
    expect(generatePokemon(model, {}, 1).stats).not.toEqual(generatePokemon(model, {}, 2).stats)
  })

  it("keeps requested fields", () => {
    const pokemon = generatePokemon(model, {
      class: "stage",
      stage: { index: 3, of: 3 },
      types: ["fire", "flying"],
      archetype: "fast",
      bst: 530,
      abilities: ["blaze"],
      name: "pyrowing"
    }, 1)

    expect(pokemon).toMatchObject({
      name: "pyrowing", class: "stage", stage: { index: 3, of: 3 }, types: ["fire", "flying"], archetype: "fast"
    })
    expect(bstOf(pokemon)).toBe(530)
    expect(pokemon.abilities[0]).toBe("blaze")
    expect(pokemon.explain?.length).toBeGreaterThan(0)
  })
})

describe("statistics of 5000 unconstrained pokemon", () => {
  const pokemon = generateMany(5000)
  const column = (stat: typeof STATS[number]) => pokemon.map(item => item.stats[stat])

  it("are all plausible", () => {
    expect(pokemon.flatMap(item => validatePokemon(model, item).violations)).toEqual([])
  })

  it("keep the mean stat shares within 1 pp of the model", () => {
    for (const stat of STATS) {
      expect(Math.abs(meanShare(pokemon, stat) - model.profile.mean[stat])).toBeLessThan(0.01)
    }
  })

  it("have two types about as often as real pokemon", () => {
    expect(pokemon.filter(item => item.types.length === 2).length / pokemon.length).toBeCloseTo(0.51, 1)
    expect(Math.abs(pokemon.filter(item => item.types.length === 2).length / pokemon.length - 0.51)).toBeLessThan(0.05)
  })

  it("reproduce the correlations between stats and size", () => {
    expect(correlation(column("defense"), column("specialDefense"))).toBeGreaterThanOrEqual(0.35)

    const defenseSpeed = correlation(column("defense"), column("speed"))

    expect(defenseSpeed).toBeGreaterThanOrEqual(-0.15)
    expect(defenseSpeed).toBeLessThanOrEqual(0.15)
    expect(correlation(pokemon.map(bstOf), pokemon.map(item => Math.log(item.heightDm)))).toBeGreaterThanOrEqual(0.55)
  })

  it("follow the ability count distribution of each class", () => {
    const byClass = Map.groupBy(pokemon, item => classKeyOf(item.class, item.stage))

    for (const [key, items] of byClass) {
      // Small samples are too noisy for a 10 pp bound
      if (items.length < 100) {
        continue
      }

      model.classes[key].abilityCount.forEach((p, i) => {
        const share = items.filter(item => item.abilities.length === i + 1).length / items.length

        expect(Math.abs(share - p), `${key}, ${i + 1} abilities`).toBeLessThanOrEqual(0.1)
      })
    }
  })
})

describe("types and abilities shape the profile", () => {
  const all = generateMany(1000)

  it("gives rock pokemon more defense and less speed", () => {
    const rock = generateMany(1000, { types: ["rock"] })

    expect(meanShare(rock, "defense") - model.profile.mean.defense).toBeGreaterThanOrEqual(0.04)
    expect(model.profile.mean.speed - meanShare(rock, "speed")).toBeGreaterThanOrEqual(0.02)
  })

  it("raises defense with sturdy", () => {
    expect(meanShare(generateMany(500, { abilities: ["sturdy"] }), "defense")).toBeGreaterThan(meanShare(all, "defense"))
  })

  it("applies the compensation rules", () => {
    for (const pokemon of generateMany(200, { abilities: ["huge-power"] })) {
      expect(toShares(toVector(pokemon.stats))[STATS.indexOf("attack")]).toBeLessThanOrEqual(0.12 + 0.01)
    }

    for (const pokemon of generateMany(200, { abilities: ["wonder-guard"] })) {
      expect(pokemon.stats.hp).toBe(1)
      expect(validatePokemon(model, pokemon).violations).toEqual([])
    }

    for (const pokemon of generateMany(50, { abilities: ["imposter"] })) {
      expect(new Set(toVector(pokemon.stats)).size).toBe(1)
    }
  })

  it("never picks a restricted compensating ability for legendaries at random", () => {
    for (const pokemon of generateMany(300, { class: "legendary" })) {
      expect(pokemon.abilities).not.toContain("huge-power")
      expect(pokemon.abilities).not.toContain("wonder-guard")
    }
  })
})

describe("evolution lines", () => {
  const lines = seeds(500).map(seed => generateEvolutionLine(model, { length: 3 }, seed))

  it("grow like real lines of three", () => {
    expect(lines.flatMap(line => validateLine(model, line).violations)).toEqual([])
    expect(Math.abs(median(lines.map(line => bstOf(line[1]) / bstOf(line[0]))) - 1.33)).toBeLessThanOrEqual(0.05)
    expect(Math.abs(median(lines.map(line => bstOf(line[2]) / bstOf(line[1]))) - 1.33)).toBeLessThanOrEqual(0.05)
    expect(Math.max(...lines.map(line => bstOf(line[2])))).toBeLessThanOrEqual(600)
  })

  it("keep the profile between stages", () => {
    for (const line of lines) {
      for (let i = 1; i < line.length; i++) {
        expect(profileCorrelation(toVector(line[i - 1].stats), toVector(line[i].stats))).toBeGreaterThanOrEqual(0.85)
      }
    }
  })

  it("mark the stages", () => {
    const line = generateEvolutionLine(model, { length: 2, types: ["water"], abilities: ["torrent"] }, 3)

    expect(line.map(item => item.stage)).toEqual([{ index: 1, of: 2 }, { index: 2, of: 2 }])
    expect(line.every(item => item.types.join() === "water" && item.abilities[0] === "torrent")).toBe(true)
  })
})

describe("mega forms", () => {
  it("add 100 BST, keep HP and have one ability", () => {
    const finals = seeds(200).map(seed => generateEvolutionLine(model, { length: 3 }, seed)[2])

    for (const [i, base] of finals.entries()) {
      const mega = generateMegaForm(model, base, i)

      expect(bstOf(mega) - bstOf(base)).toBe(100)
      expect(mega.stats.hp).toBe(base.stats.hp)
      expect(mega.abilities).toHaveLength(1)
      expect(mega).toMatchObject({ form: "mega", name: `${base.name}-mega`, types: base.types })
    }
  })

  it("refuses bases that cannot have a mega form", () => {
    const first = generateEvolutionLine(model, { length: 3 }, 1)[0]

    expect(canHaveMega(first)).toBe(false)
    expect(violationsOf(() => generateMegaForm(model, first, 1))).toHaveLength(1)
  })
})

describe("request errors", () => {
  it("lists contradictions instead of adjusting silently", () => {
    expect(violationsOf(() => generatePokemon(model, { class: "legendary", bst: 300 }, 1))[0]).toMatch(/outside the tier/)
    expect(violationsOf(() => generatePokemon(model, { class: "single", stage: { index: 1, of: 2 } }, 1))[0])
      .toMatch(/stage is only allowed/)
    expect(violationsOf(() => generatePokemon(model, { bst: 620 }, 1))[0]).toMatch(/forbidden window/)
    expect(violationsOf(() => generatePokemon(model, { abilities: ["no-such", "nope"] }, 1)))
      .toEqual(["unknown ability \"no-such\"", "unknown ability \"nope\""])
    expect(violationsOf(() => generateEvolutionLine(model, { length: 2, abilities: ["no-such"] }, 1)))
      .toEqual(["unknown ability \"no-such\""])
  })

  it("rejects unknown types and malformed fields in the schema", () => {
    expect(generateRequestSchema.safeParse({ types: ["shadow"] }).success).toBe(false)
    expect(generateRequestSchema.safeParse({ types: ["fire", "fire"] }).success).toBe(false)
    expect(generateRequestSchema.safeParse({ stage: { index: 3, of: 2 } }).success).toBe(false)
    expect(generateRequestSchema.safeParse({ name: "Bad Name" }).success).toBe(false)
  })
})

describe("hand-made pokemon (mode custom)", () => {
  const custom = {
    class: "stage" as const,
    stage: { index: 3, of: 3 },
    types: ["fire" as const],
    abilities: ["blaze", "solar-power"],
    stats: { hp: 80, attack: 100, defense: 80, specialAttack: 100, specialDefense: 80, speed: 80 }
  }

  it("keeps the stats and adds size, experience and the closest archetype", () => {
    const pokemon = buildCustomPokemon(model, custom, 1)

    expect(pokemon).toMatchObject({
      stats: custom.stats, types: ["fire"], abilities: ["blaze", "solar-power"], input: { mode: "custom" }
    })
    expect(validatePokemon(model, pokemon).violations).toEqual([])
    expect(JSON.stringify(buildCustomPokemon(model, custom, 1))).toBe(JSON.stringify(pokemon))
  })

  it("does not apply the slot 1 type rule to abilities the user chose", () => {
    expect(() => buildCustomPokemon(model, { ...custom, abilities: ["torrent"] }, 1)).not.toThrow()
  })

  it("rejects implausible stats as a request error", () => {
    const weak = { ...custom, stats: { ...custom.stats, speed: 5, hp: 5 } }
    const violations = violationsOf(() => buildCustomPokemon(model, weak, 1))

    expect(violations.some(text => text.includes("outside the stage3of3 tier"))).toBe(true)
    expect(violationsOf(() => buildCustomPokemon(model, { ...custom, stage: undefined }, 1)))
      .toEqual(["class \"stage\" needs a stage"])
  })
})
