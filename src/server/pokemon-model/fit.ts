import { ARCHETYPES, POKEMON_TYPES, STATS, type Archetype, type PokemonType } from "@shared/api/schema/pokemon/generated"
import type { PokemonStats } from "@schema/pokemonInfoSchema"
import { classKeyOf, combineByTypes } from "./classes"
import {
  ceil5, correlation, covariance, floor5, fromVector, linearFit, mean, median, quantile, roundTo, sd, sum, toShares,
  toVector
} from "./math"
import {
  CLASS_KEYS, EXPERIENCE_KS, MODEL_VERSION, type ClassKey, type EvolutionStep, type ModelAbility, type PokemonModel,
  type StatVector
} from "./schema"

/** One pokemon_info row, as the fit reads it */
export type FitPokemonRow = {
  externalId: number
  name: string
  types: string[]
  abilities: string[]
  heightDm: number
  weightHg: number
  baseExperience: number | null
  stats: PokemonStats
}

// PokeAPI numbers above this are alternative forms (mega, gmax, regional...)
const FORM_ID_FROM = 10000

const FORBIDDEN_BST: [number, number][] = [[601, 639]]

// Singles with BST from here are semi-legendary, from LEGENDARY_BST legendary
const SEMI_LEGENDARY_BST = 570
const LEGENDARY_BST = 640
const PSEUDO_LEGENDARY_BST = 600

// Abilities with fewer carriers get no profile shift
const MIN_SHIFT_CARRIERS = 8
// An ability is universal when no type has more than this share of its carriers
const UNIVERSAL_MAX_TYPE_SHARE = 0.35
const UNIVERSAL_MIN_CARRIERS = 6
// base_experience / BST above this is a hand-picked outlier (chansey, blissey, audino)
const MAX_EXPERIENCE_RATIO = 0.6

const FORM_KINDS = ["mega", "primal", "gmax", "alola", "galar", "hisui", "paldea", "totem"] as const

/**
 * Seeds of the archetype clustering, in share units. k-means starts from them,
 * so cluster i keeps the meaning of ARCHETYPES[i].
 */
const ARCHETYPE_SEEDS: Record<Archetype, number[]> = {
  //          hp     atk    def    spa    spd    spe
  physical: [0.01, 0.05, 0, -0.04, -0.01, -0.01],
  special: [-0.01, -0.04, -0.01, 0.05, 0.01, 0],
  tank: [0, -0.01, 0.05, -0.02, 0.03, -0.05],
  fast: [-0.02, 0.01, -0.03, 0.01, -0.02, 0.05],
  hpWall: [0.08, -0.02, -0.02, -0.02, 0, -0.02],
  balanced: [0, 0, 0, 0, 0, 0]
}

type Row = FitPokemonRow & {
  types: PokemonType[]
  bst: number
  shares: number[]
  classKey: ClassKey
  family: number
  stage: number
  familySize: number
}

const bstOf = (stats: PokemonStats) => sum(toVector(stats))

const isKnownType = (type: string): type is PokemonType => (POKEMON_TYPES as readonly string[]).includes(type)

const shareOf = <T>(items: T[], predicate: (item: T) => boolean) => (items.length === 0
  ? 0
  : items.filter(predicate).length / items.length)

const roundVector = (values: number[]) => fromVector(values.map(value => roundTo(value)))

/** Probabilities of each distinct value, sorted by value */
const distribution = (values: number[]) => {
  const counts = new Map<number, number>()

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }

  return [...counts.entries()]
    .sort(([a], [b]) => a - b)
    .map(([value, count]) => ({ value, p: roundTo(count / values.length) }))
}

/**
 * Evolution lines are not stored: consecutive numbers sharing a type and an ability
 * with a growing BST are taken as one line (docs/pokemon-model.md, "Классы и BST").
 */
const markFamilies = (rows: Omit<Row, "classKey" | "family" | "stage" | "familySize">[]) => {
  const families: number[] = []

  rows.forEach((row, i) => {
    const previous = rows[i - 1]
    const sameLine = previous !== undefined
      && row.externalId === previous.externalId + 1
      && row.bst > previous.bst
      && row.types.some(type => previous.types.includes(type))
      && row.abilities.some(ability => previous.abilities.includes(ability))

    families.push(i === 0 ? 0 : sameLine ? families[i - 1] : families[i - 1] + 1)
  })

  const sizes = new Map<number, number>()

  for (const family of families) {
    sizes.set(family, (sizes.get(family) ?? 0) + 1)
  }

  let stage = 0

  return rows.map((row, i): Row => {
    stage = i > 0 && families[i] === families[i - 1] ? stage + 1 : 1
    // Lines longer than 3 are a false merge; their stages are treated as singles
    const familySize = sizes.get(families[i])! <= 3 ? sizes.get(families[i])! : 1

    let classKey: ClassKey

    if (familySize === 1) {
      classKey = row.bst >= LEGENDARY_BST ? "legendary" : row.bst >= SEMI_LEGENDARY_BST ? "semiLegendary" : "single"
    }
    else if (familySize === 3 && stage === 3 && row.bst === PSEUDO_LEGENDARY_BST) {
      classKey = "pseudoLegendary"
    }
    else {
      classKey = classKeyOf("stage", { index: stage, of: familySize })
    }

    return { ...row, classKey, family: families[i], stage: familySize === 1 ? 1 : stage, familySize }
  })
}

const typeShares = (rows: Row[], type: PokemonType) => rows.filter(row => row.types.includes(type))

/**
 * k-means with fixed starting centers, so the result is deterministic and cluster i stays archetype i.
 * Centers listed in `anchored` never move (the balanced archetype stays at zero offset).
 */
const kMeans = (points: number[][], seeds: number[][], anchored: Set<number>, iterations = 50) => {
  let centers = seeds.map(seed => [...seed])
  let labels = new Array<number>(points.length).fill(0)

  for (let iteration = 0; iteration < iterations; iteration++) {
    labels = points.map((point) => {
      const distances = centers.map(center => sum(point.map((value, j) => (value - center[j]) ** 2)))

      return distances.indexOf(Math.min(...distances))
    })

    centers = centers.map((center, k) => {
      const members = points.filter((_, i) => labels[i] === k)

      return members.length === 0 || anchored.has(k) ? center : center.map((_, j) => mean(members.map(member => member[j])))
    })
  }

  return { centers, labels }
}

const formKind = (name: string, root: string) => {
  const suffix = name.slice(root.length + 1)

  return FORM_KINDS.find(kind => suffix === kind || suffix.startsWith(`${kind}-`)) ?? "other"
}

/**
 * Fits the generator model from pokemon_info rows of one source (pure: no DB, no clock).
 * `abilityNames` are the abilities present in the `ability` table; others are left out of the model.
 */
export const fitModel = (input: FitPokemonRow[], abilityNames: string[], fittedAt: string): PokemonModel => {
  const known = input.filter(row => row.types.length > 0 && row.types.every(isKnownType))
  const prepared = known
    .filter(row => row.externalId < FORM_ID_FROM)
    .sort((a, b) => a.externalId - b.externalId)
    .map((row) => {
      const values = toVector(row.stats)

      return { ...row, types: row.types as PokemonType[], bst: sum(values), shares: toShares(values) }
    })
  const rows = markFamilies(prepared)
  const forms = known.filter(row => row.externalId > FORM_ID_FROM)
  const abilitySet = new Set(abilityNames)

  const meanShares = STATS.map((_, j) => mean(rows.map(row => row.shares[j])))
  const meanBst = mean(rows.map(row => row.bst))

  // Classes
  const classes = Object.fromEntries(CLASS_KEYS.map((key) => {
    const members = rows.filter(row => row.classKey === key)
    const bsts = members.map(row => row.bst)
    const stats = members.flatMap(row => toVector(row.stats)).filter(value => value >= 5)
    const ks = members
      .filter(row => row.baseExperience !== null && row.baseExperience / row.bst <= MAX_EXPERIENCE_RATIO)
      .map((row) => {
        const ratio = row.baseExperience! / row.bst

        return EXPERIENCE_KS.reduce((best, k) => (Math.abs(k - ratio) < Math.abs(best - ratio) ? k : best))
      })
    const abilityCounts = [1, 2, 3].map(count => roundTo(shareOf(members, row => row.abilities.length === count)))

    return [key, {
      count: members.length,
      bst: {
        mean: roundTo(mean(bsts)),
        sd: roundTo(sd(bsts)),
        // 1st-99th percentile, so one misdetected line does not widen the tier
        min: floor5(quantile(bsts, 0.01)),
        max: Math.min(ceil5(quantile(bsts, 0.99)), 720)
      },
      stat: stats.length > 0
        ? { min: Math.max(5, floor5(Math.min(...stats))), max: Math.min(255, ceil5(Math.max(...stats))) }
        : { min: 5, max: 255 },
      // An empty class (count 0) is never generated; the fallback only keeps the schema valid
      experience: ks.length > 0 ? distribution(ks) : [{ value: 0.35, p: 1 }],
      abilityCount: abilityCounts as [number, number, number]
    }]
  })) as PokemonModel["classes"]

  // Evolution
  const families = [...new Set(rows.filter(row => row.familySize > 1).map(row => row.family))]
    .map(family => rows.filter(row => row.family === family))
  const pairs = families.flatMap(line => line.slice(1).map((row, i) => ({ previous: line[i], next: row, size: line.length })))
  const stepOf = (stage: number, size: number) => `${stage}to${stage + 1}of${size}` as EvolutionStep

  const steps = Object.fromEntries((["1to2of2", "1to2of3", "2to3of3"] as const).map((step) => {
    const members = pairs.filter(({ previous, size }) => stepOf(previous.stage, size) === step)
    const ratios = members.map(({ previous, next }) => next.bst / previous.bst)
    const statRatio = STATS.map(stat => median(members.map(({ previous, next }) => next.stats[stat] / previous.stats[stat])))
    const drifts = members.flatMap(({ previous, next }) => next.shares.map((share, j) => share - previous.shares[j]))
    const mono = members.filter(({ previous }) => previous.types.length === 1)

    return [step, {
      count: members.length,
      bstRatio: { median: roundTo(median(ratios)), sd: roundTo(sd(ratios)) },
      statRatio: roundVector(statRatio),
      heightRatio: roundTo(median(members.map(({ previous, next }) => next.heightDm / previous.heightDm))),
      weightRatio: roundTo(median(members.map(({ previous, next }) => next.weightHg / previous.weightHg))),
      profileDriftSd: roundTo(sd(drifts)),
      addSecondTypeP: roundTo(shareOf(mono, ({ next }) => next.types.length === 2))
    }]
  })) as PokemonModel["evolution"]["steps"]

  const sameAbilities = shareOf(families, line => line.every(row => row.abilities.join() === line[0].abilities.join()))
  const profileCorrelation = median(pairs.map(({ previous, next }) => correlation(previous.shares, next.shares)))

  // Types
  const typeProfileShift = Object.fromEntries(POKEMON_TYPES.map((type) => {
    const carriers = typeShares(rows, type)

    return [type, STATS.map((_, j) => mean(carriers.map(row => row.shares[j])) - meanShares[j])]
  })) as Record<PokemonType, number[]>

  const typeShiftOf = (types: PokemonType[]) => STATS
    .map((_, j) => combineByTypes(types, type => typeProfileShift[type as PokemonType][j]))

  // Size
  const heightFit = linearFit(rows.map(row => row.bst), rows.map(row => Math.log(row.heightDm)))
  const weightFit = linearFit(rows.map(row => Math.log(row.heightDm)), rows.map(row => Math.log(row.weightHg)))
  const weightResidual = (row: Row) => Math.log(row.weightHg) - weightFit.intercept - weightFit.slope * Math.log(row.heightDm)
  const weightShift = Object.fromEntries(POKEMON_TYPES.map(type => [type, mean(typeShares(rows, type).map(weightResidual))])) as
    Record<PokemonType, number>
  const weightSd = sd(rows.map(row => weightResidual(row) - combineByTypes(row.types, type => weightShift[type as PokemonType])))

  const types = Object.fromEntries(POKEMON_TYPES.map((type) => {
    const primary = rows.filter(row => row.types[0] === type)
    const dual = primary.filter(row => row.types.length === 2)
    const secondary = Object.fromEntries(POKEMON_TYPES
      .map(second => [second, shareOf(dual, row => row.types[1] === second)] as const)
      .filter(([, p]) => p > 0)
      .map(([second, p]) => [second, roundTo(p)]))

    return [type, {
      primary: roundTo(primary.length / rows.length),
      secondaryP: roundTo(shareOf(primary, row => row.types.length === 2)),
      secondary,
      bstShift: roundTo(mean(typeShares(rows, type).map(row => row.bst)) - meanBst),
      profileShift: roundVector(typeProfileShift[type]),
      weightShift: roundTo(weightShift[type])
    }]
  })) as PokemonModel["types"]

  // Profile archetypes: clusters of the shares left after the type shift
  const residuals = rows.map(row => row.shares.map((share, j) => share - meanShares[j] - typeShiftOf(row.types)[j]))
  const { centers, labels } = kMeans(
    residuals,
    ARCHETYPES.map(archetype => ARCHETYPE_SEEDS[archetype]),
    new Set([ARCHETYPES.indexOf("balanced")])
  )
  const globalCov = covariance(residuals)

  const archetypes = Object.fromEntries(ARCHETYPES.map((archetype, k) => {
    const members = residuals.filter((_, i) => labels[i] === k).map(point => point.map((value, j) => value - centers[k][j]))
    const cov = members.length >= 7 ? covariance(members) : globalCov

    return [archetype, {
      weight: roundTo(members.length / residuals.length),
      center: roundVector(centers[k]),
      cov: cov.map(row => row.map(value => roundTo(value, 7)))
    }]
  })) as PokemonModel["profile"]["archetypes"]

  // Abilities
  type AbilityAccumulator = {
    carriers: number[]
    types: Partial<Record<PokemonType, number>>
    slots: ModelAbility["slots"]
  }

  const accumulators = new Map<string, AbilityAccumulator>()

  rows.forEach((row, i) => {
    row.abilities.forEach((name, position) => {
      if (!abilitySet.has(name)) {
        return
      }

      const accumulator = accumulators.get(name) ?? { carriers: [], types: {}, slots: { first: 0, second: 0, hidden: 0 } }

      accumulators.set(name, accumulator)
      accumulator.carriers.push(i)

      for (const type of row.types) {
        accumulator.types[type] = (accumulator.types[type] ?? 0) + 1
      }

      // With two abilities the second one may be a regular or the hidden one: only position 1 and full lists count
      if (position === 0) {
        accumulator.slots.first++
      }
      else if (row.abilities.length === 3) {
        accumulator.slots[position === 1 ? "second" : "hidden"]++
      }
    })
  })

  const abilities = Object.fromEntries([...accumulators.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, { carriers, types: carrierTypes, slots }]): [string, ModelAbility] => {
      const count = carriers.length
      const maxTypeShare = Math.max(...Object.values(carrierTypes)) / count

      return [name, {
        count,
        types: carrierTypes,
        slots,
        shift: count >= MIN_SHIFT_CARRIERS
          ? roundVector(STATS.map((_, j) => mean(carriers.map(i => residuals[i][j]))))
          : null,
        universal: count >= UNIVERSAL_MIN_CARRIERS && maxTypeShare <= UNIVERSAL_MAX_TYPE_SHARE,
        meanBst: roundTo(mean(carriers.map(i => rows[i].bst)), 1)
      }]
    }))

  // Forms: matched to the base pokemon by the longest name prefix
  const byName = [...rows].sort((a, b) => b.name.length - a.name.length)
  const matched = forms
    .map(form => ({ form, base: byName.find(row => form.name.startsWith(`${row.name}-`)) }))
    .filter((item): item is { form: FitPokemonRow, base: Row } => item.base !== undefined)
    .map(({ form, base }) => ({ form, base, kind: formKind(form.name, base.name) }))

  const formSummary = Object.fromEntries([...FORM_KINDS, "other"].map((kind) => {
    const members = matched.filter(item => item.kind === kind)

    return [kind, {
      count: members.length,
      bstDelta: roundTo(median(members.map(({ form, base }) => bstOf(form.stats) - base.bst))),
      sameTypes: roundTo(shareOf(members, ({ form, base }) => form.types.join() === base.types.join())),
      sameAbilities: roundTo(shareOf(members, ({ form, base }) => form.abilities.join() === base.abilities.join()))
    }]
  }))

  const megas = matched.filter(item => item.kind === "mega")
  const megaStatDelta: StatVector = roundVector(STATS
    .map(stat => mean(megas.map(({ form, base }) => form.stats[stat] - base.stats[stat]))))
  const megaExperience = megas
    .filter(({ form, base }) => form.baseExperience !== null && base.baseExperience !== null)
    .map(({ form, base }) => form.baseExperience! - base.baseExperience!)

  return {
    version: MODEL_VERSION,
    fittedAt,
    sourceCounts: {
      pokemon: rows.length,
      forms: forms.length,
      abilities: Object.keys(abilities).length,
      lines2: families.filter(line => line.length === 2).length,
      lines3: families.filter(line => line.length === 3).length
    },
    forbiddenBst: FORBIDDEN_BST,
    classes,
    evolution: { steps, sameAbilities: roundTo(sameAbilities), profileCorrelation: roundTo(profileCorrelation) },
    types,
    profile: { mean: roundVector(meanShares), archetypes },
    size: {
      height: { intercept: roundTo(heightFit.intercept), slope: roundTo(heightFit.slope, 7), sd: roundTo(heightFit.sd) },
      weight: { intercept: roundTo(weightFit.intercept), slope: roundTo(weightFit.slope), sd: roundTo(weightSd) },
      heightRange: { min: 1, max: Math.max(...rows.map(row => row.heightDm)) },
      weightRange: { min: 1, max: Math.max(...rows.map(row => row.weightHg)) }
    },
    abilities,
    forms: formSummary,
    mega: {
      statDelta: megaStatDelta,
      experienceDelta: megaExperience.length > 0 ? distribution(megaExperience) : [{ value: 40, p: 1 }]
    }
  }
}
