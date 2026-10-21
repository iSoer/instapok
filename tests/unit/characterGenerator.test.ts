import { describe, expect, it } from "vitest"
import {
  buildCustomCharacter, generateCharacter, updateCharacter, type GeneratedCharacter
} from "@/server/character-model/generate"
import { REFERENCE_CLASS, loadCharacterModel } from "@/server/character-model/model"
import { validateCharacter } from "@/server/character-model/validate"
import { GenerateRequestError } from "@/server/pokemon-model/generate"
import {
  customCharacterSchema, generateCharacterRequestSchema, type GenerateCharacterRequestType
} from "@shared/api/schema/character/generated"
import { STATS } from "@shared/api/schema/pokemon/generated"
import {
  MAX_LEVEL, RARITIES, statAtLevel, statsAtLevel, totalOfStats, type Rarity
} from "@shared/character/leveling"
import {
  CHARACTER_CLASSES, CLASS_TIERS, TIER_LEVELS, availableClasses, classBonusOf, classById, earliestLevelOf, mountOf, movementOf,
  statsInClass
} from "@shared/character/classes"
import { SKILLS, aptitudesOf, rankAtLevel, rankIndex, ranksAtLevel, skillsWith } from "@shared/character/skills"

const model = loadCharacterModel()

const seeds = (count: number, from = 1) => Array.from({ length: count }, (_, i) => from + i)

const generateMany = (count: number, request: GenerateCharacterRequestType = {}) => seeds(count)
  .map(seed => generateCharacter(model, request, seed))

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length

const share = (characters: GeneratedCharacter[], stat: typeof STATS[number]) => mean(characters
  .map(character => character.maxStats[stat] / totalOfStats(character.maxStats)))

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

describe("model", () => {
  it("makes a 5★ character at max level a final stage of a line of three and level 1 its first stage", () => {
    const reference = model.pokemon.classes[REFERENCE_CLASS].bst

    expect(model.rarities[5].budget).toMatchObject({ min: reference.min, max: reference.max, mean: reference.mean })
    expect(model.bstGrowth).toBeCloseTo(1.75, 2)
    expect(Math.abs(reference.mean / model.bstGrowth - model.pokemon.classes.stage1of3.bst.mean)).toBeLessThan(10)
  })

  it("gives every star a small, growing bonus like Fire Emblem Heroes", () => {
    const factors = RARITIES.map(rarity => model.rarities[rarity].budgetFactor)

    expect(model.rarities[5]).toMatchObject({ budgetFactor: 1, baseMultiplier: 1, growthMultiplier: 1 })
    expect(model.rarities[1].growthMultiplier).toBeCloseTo(0.86 / 1.14, 4)

    for (let i = 1; i < factors.length; i++) {
      expect(factors[i] - factors[i - 1]).toBeGreaterThan(0.02)
      expect(factors[i] - factors[i - 1]).toBeLessThan(0.05)
    }
  })
})

describe("leveling", () => {
  it("goes from level 1 to the max level linearly and never down", () => {
    expect(statAtLevel(50, 129, 1)).toBe(50)
    expect(statAtLevel(50, 129, MAX_LEVEL)).toBe(129)
    expect(statAtLevel(50, 129, 40)).toBe(89)

    for (const character of generateMany(30)) {
      let previous = character.baseStats

      expect(statsAtLevel(character.baseStats, character.maxStats, MAX_LEVEL)).toEqual(character.maxStats)

      for (let level = 2; level <= MAX_LEVEL; level++) {
        const stats = statsAtLevel(character.baseStats, character.maxStats, level)

        expect(STATS.every(stat => stats[stat] >= previous[stat])).toBe(true)
        previous = stats
      }
    }
  })

  it("grows a 5★ character as much as an evolution line and a 1★ one less", () => {
    const ratio = (rarity: Rarity) => mean(generateMany(200, { rarity })
      .map(character => totalOfStats(character.maxStats) / totalOfStats(character.baseStats)))

    expect(ratio(5)).toBeCloseTo(model.bstGrowth, 1)
    expect(ratio(1)).toBeLessThan(ratio(5))
  })
})

describe("skills", () => {
  it("rank a talent up just in time for every class tier", () => {
    expect(rankAtLevel("talent", 1)).toBe("D")
    expect(rankAtLevel("talent", TIER_LEVELS.specialty)).toBe("C")
    expect(rankAtLevel("talent", TIER_LEVELS.advanced)).toBe("B+")
    expect(rankAtLevel("talent", TIER_LEVELS.master)).toBe("A")
    expect(rankAtLevel("talent", 55)).toBe("S")
    expect(rankAtLevel("normal", 1)).toBe("E+")
    expect(rankAtLevel("normal", MAX_LEVEL)).toBe("A")
    expect(rankAtLevel("weak", MAX_LEVEL)).toBe("C")
  })

  it("never lose a rank with the level", () => {
    for (const aptitude of ["weak", "normal", "talent"] as const) {
      for (let level = 2; level <= MAX_LEVEL; level++) {
        expect(rankIndex(rankAtLevel(aptitude, level))).toBeGreaterThanOrEqual(rankIndex(rankAtLevel(aptitude, level - 1)))
      }
    }
  })

  it("shape the profile like pokemon types: magic talents get more magic, heavy armor more defense", () => {
    const mages = generateMany(200, { talents: ["blackMagic"] })
    const fighters = generateMany(200, { talents: ["axe"] })
    const knights = generateMany(200, { talents: ["heavyArmor"] })

    expect(share(mages, "specialAttack")).toBeGreaterThan(share(fighters, "specialAttack") + 0.05)
    expect(share(fighters, "attack")).toBeGreaterThan(share(mages, "attack") + 0.05)
    expect(share(knights, "defense")).toBeGreaterThan(share(mages, "defense") + 0.05)
  })
})

describe("classes", () => {
  it("open by level tier and by ranks", () => {
    const aptitudes = aptitudesOf(["sword"])

    expect(availableClasses(aptitudes, 1).map(item => item.id)).toEqual(["commoner", "noble"])
    expect(availableClasses(aptitudes, 5).map(item => item.id)).toContain("gladiator")
    // Sword C at 20 with a talent, but no bow talent for an archer
    expect(availableClasses(aptitudes, 20).map(item => item.id)).toContain("myrmidon")
    expect(availableClasses(aptitudes, 20).map(item => item.id)).not.toContain("archer")
    expect(earliestLevelOf(classById("the-blade")!, aptitudes)).toBe(TIER_LEVELS.divine)
    // A normal sword never reaches S
    expect(earliestLevelOf(classById("the-blade")!, aptitudesOf(["axe"]))).toBeUndefined()
  })

  it("can all be generated on request, at the level their tier opens", () => {
    for (const item of CHARACTER_CLASSES) {
      const character = generateCharacter(model, { class: item.id }, 1)

      expect(character.class).toBe(item.id)
      expect(character.level).toBe(TIER_LEVELS[item.tier])
      expect(validateCharacter(model, character).ok).toBe(true)
    }
  })

  it("ride only horses, pegasi and dragons", () => {
    const ids = CHARACTER_CLASSES.map(item => item.id)

    for (const removed of ["ornius-rider", "armored-ornius-rider", "caladrius", "charioteer", "elephant-rider"]) {
      expect(ids).not.toContain(removed)
    }

    for (const item of CHARACTER_CLASSES) {
      const movement = movementOf(item)

      if (movement === "cavalry") {
        expect(mountOf(item)).toBe("horse")
      }
      else if (movement === "flier") {
        expect(["pegasus", "dragon"]).toContain(mountOf(item))
      }
      else {
        expect(mountOf(item)).toBeUndefined()
      }
    }

    expect(mountOf(classById("great-knight")!)).toBe("horse")
    expect(mountOf(classById("celestial-trooper")!)).toBe("pegasus")
    expect(mountOf(classById("bau-lord")!)).toBe("dragon")
  })

  it("give a bonus that grows with the tier and follows the class role", () => {
    const total = (id: string) => totalOfStats(classBonusOf(classById(id)!))
    const knight = classBonusOf(classById("armored-knight")!)

    expect(total("commoner")).toBe(0)
    expect(total("soldier")).toBeLessThan(total("armored-knight"))
    expect(total("armored-knight")).toBeLessThan(total("dreadnought"))
    expect(total("dreadnought")).toBeLessThan(total("castle-knight"))
    expect(knight.defense).toBeGreaterThan(knight.speed)
    expect(classBonusOf(classById("druid")!).specialAttack).toBeGreaterThan(classBonusOf(classById("druid")!).attack)
  })

  it("add the bonus to the leveled stats", () => {
    const character = generateCharacter(model, { class: "armored-knight", level: 30 }, 3)
    const own = statsAtLevel(character.baseStats, character.maxStats, 30)
    const bonus = classBonusOf(classById("armored-knight")!)

    expect(character.stats).toEqual(statsInClass(character.baseStats, character.maxStats, 30, classById("armored-knight")!))
    expect(character.stats.defense).toBe(own.defense + bonus.defense)
  })
})

describe("generation", () => {
  it("gives the same character for the same seed", () => {
    expect(JSON.stringify(generateCharacter(model, {}, 42))).toBe(JSON.stringify(generateCharacter(model, {}, 42)))
    expect(new Set(seeds(50).map(seed => generateCharacter(model, {}, seed).name)).size).toBeGreaterThan(45)
  })

  it("keeps requested fields", () => {
    const character = generateCharacter(model, {
      rarity: 4,
      archetype: "fast",
      budget: 500,
      talents: ["bow", "riding"],
      level: 50,
      class: "bow-knight",
      name: "arrowind"
    }, 1)

    expect(character).toMatchObject({ rarity: 4, archetype: "fast", level: 50, class: "bow-knight", name: "arrowind" })
    expect(skillsWith(character.aptitudes, "talent")).toEqual(["bow", "riding"])
    expect(totalOfStats(character.maxStats)).toBe(500)
  })

  it("are all plausible: 3000 random characters pass the validator and use every tier", () => {
    const characters = generateMany(3000)

    expect(characters.filter(character => !validateCharacter(model, character).ok)).toEqual([])
    expect(new Set(characters.map(character => classById(character.class)!.tier))).toEqual(new Set(CLASS_TIERS))
    expect(characters.every((character) => {
      const talents = skillsWith(character.aptitudes, "talent").length

      return talents >= 1 && talents <= 3 && SKILLS.every(skill => character.aptitudes[skill])
    })).toBe(true)
  })

  it("puts each rarity into its tier", () => {
    for (const rarity of RARITIES) {
      const totals = generateMany(200, { rarity }).map(character => totalOfStats(character.maxStats))
      const { min, max, mean: expected } = model.rarities[rarity].budget

      expect(Math.min(...totals)).toBeGreaterThanOrEqual(min)
      expect(Math.max(...totals)).toBeLessThanOrEqual(max)
      expect(Math.abs(mean(totals) - expected)).toBeLessThan(10)
    }
  })
})

describe("request errors", () => {
  it("lists contradictions instead of adjusting silently", () => {
    expect(violationsOf(() => generateCharacter(model, { rarity: 1, budget: 540 }, 1))[0]).toMatch(/outside the tier: 1★ 385-465/)
    expect(violationsOf(() => generateCharacter(model, { class: "sniper", level: 20 }, 1))[0]).toMatch(/opens at level 35/)
    // A normal sword never reaches S
    expect(violationsOf(() => generateCharacter(model, { class: "the-blade", talents: ["axe"] }, 1))[0])
      .toMatch(/do not open The Blade/)
    // Without a bow talent a sniper opens later than its tier, at the level a normal bow reaches B
    expect(generateCharacter(model, { class: "sniper", talents: ["axe"] }, 1).level).toBe(58)
  })

  it("rejects unknown rarities, classes and skills in the schema", () => {
    expect(generateCharacterRequestSchema.safeParse({ rarity: 6 }).success).toBe(false)
    expect(generateCharacterRequestSchema.safeParse({ class: "pegasus-knight" }).success).toBe(false)
    expect(generateCharacterRequestSchema.safeParse({ talents: ["staff"] }).success).toBe(false)
    expect(generateCharacterRequestSchema.safeParse({ talents: ["sword", "axe", "bow", "spear"] }).success).toBe(false)
  })
})

describe("hand-made characters (mode custom)", () => {
  const maxStats = { hp: 80, attack: 90, defense: 75, specialAttack: 70, specialDefense: 75, speed: 90 }
  const custom = { rarity: 4 as const, talents: ["sword" as const], weaknesses: [], maxStats, level: 20, class: "myrmidon" }

  it("keeps the choices and adds level 1, size, experience and the closest archetype", () => {
    const character = buildCustomCharacter(model, custom, 5)

    expect(character).toMatchObject({ maxStats, level: 20, class: "myrmidon" })
    expect(character.ranks).toEqual(ranksAtLevel(aptitudesOf(["sword"]), 20))
    expect(validateCharacter(model, character).ok).toBe(true)
  })

  it("rejects a class that is not open as a request error", () => {
    expect(violationsOf(() => buildCustomCharacter(model, { ...custom, class: "archer" }, 5))
      .some(text => text.includes("not open at level 20"))).toBe(true)
  })

  it("does not let a skill be a talent and a weakness", () => {
    expect(customCharacterSchema.safeParse({ ...custom, weaknesses: ["sword"] }).success).toBe(false)
  })
})

describe("level up and reclass", () => {
  const character = generateCharacter(model, { class: "myrmidon", talents: ["sword", "bow"] }, 8)

  it("keeps the class on a level up and recomputes the stats and ranks", () => {
    const updated = updateCharacter(character, { level: 40 })

    expect(updated).toMatchObject({ level: 40, class: "myrmidon" })
    expect(updated.ranks.sword).toBe(rankAtLevel("talent", 40))
    expect(validateCharacter(model, updated).ok).toBe(true)
  })

  it("changes to an open class and refuses locked classes and lower levels", () => {
    expect(updateCharacter(character, { level: 35, class: "sniper" }).class).toBe("sniper")
    expect(violationsOf(() => updateCharacter(character, { class: "sniper" }))[0]).toMatch(/not open at level 20/)
    expect(violationsOf(() => updateCharacter(character, { level: 10 }))[0]).toMatch(/levels only go up/)
  })
})
