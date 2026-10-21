import { saveGeneratedCharacter } from "@/server/db/queries/saveGeneratedCharacter"
import { generateCharacter, type GeneratedCharacter } from "@/server/character-model/generate"
import { loadCharacterModel } from "@/server/character-model/model"
import { GenerateRequestError, GenerationError } from "@/server/pokemon-model/generate"
import { randomSeed } from "@/server/pokemon-model/random"
import { MAX_SEED } from "@shared/api/schema/pokemon/generated"
import { generateCharacterRequestSchema } from "@shared/api/schema/character/generated"
import { MAX_LEVEL, totalOfStats } from "@shared/character/leveling"
import { classById } from "@shared/character/classes"
import { SKILLS, skillsWith } from "@shared/character/skills"
import { runScript } from "./utils/runQueueCli"

const USAGE = `Usage: npm run character:generate -- [options]
  --count=N              how many characters (default 1)
  --rarity=1..5          --archetype=tank --budget=480 (sum of the stats at level ${MAX_LEVEL})
  --talents=sword,riding talented skills (${SKILLS.join(", ")})
  --level=L              the character's level (1-${MAX_LEVEL}), random by default
  --class=bow-knight     the character's class; picks the talents and level it needs when they are not given
  --seed=S               seed of the first character, the next ones get S+1, S+2...
  --dry-run              print JSON and the explanation, do not save`

const KNOWN_OPTIONS = new Set([
  "count", "rarity", "archetype", "talents", "budget", "level", "class", "seed", "dry-run", "help"
])

const parseOptions = (args: string[]) => {
  const options = new Map<string, string>()

  for (const arg of args) {
    const match = /^--([a-z-]+)(?:=(.*))?$/.exec(arg)

    if (!match || !KNOWN_OPTIONS.has(match[1])) {
      throw new Error(`Unknown argument "${arg}"\n${USAGE}`)
    }

    options.set(match[1], match[2] ?? "")
  }

  return options
}

const list = (value: string | undefined) => (value ? value.split(",").filter(Boolean) : undefined)

const integer = (name: string, value: string | undefined, fallback: number) => {
  if (value === undefined) {
    return fallback
  }

  const number = Number(value)

  if (!Number.isInteger(number) || number < 0) {
    throw new Error(`Invalid --${name}=${value}`)
  }

  return number
}

const print = (character: GeneratedCharacter, saved?: { id: string }) => {
  const talents = skillsWith(character.aptitudes, "talent").join("/")

  console.log(`${character.name}  ${character.rarity}★  lv ${character.level} ${classById(character.class)!.name}  `
    + `talents ${talents}  stats ${Object.values(character.stats).join("/")} (own max BST ${totalOfStats(character.maxStats)})  `
    + `seed ${character.seed}${saved ? `  id ${saved.id}` : ""}`)
}

runScript(async () => {
  const options = parseOptions(process.argv.slice(2))

  if (options.has("help")) {
    console.log(USAGE)

    return
  }

  const model = loadCharacterModel()
  const count = integer("count", options.get("count"), 1)
  const firstSeed = integer("seed", options.get("seed"), randomSeed())
  const dryRun = options.has("dry-run")
  const request = generateCharacterRequestSchema.parse({
    rarity: options.has("rarity") ? Number(options.get("rarity")) : undefined,
    archetype: options.get("archetype"),
    talents: list(options.get("talents")),
    budget: options.has("budget") ? Number(options.get("budget")) : undefined,
    level: options.has("level") ? Number(options.get("level")) : undefined,
    class: options.get("class")
  })

  let failed = 0

  for (let i = 0; i < count; i++) {
    const seed = (firstSeed + i) % (MAX_SEED + 1)

    try {
      const character = generateCharacter(model, request, seed)

      if (dryRun) {
        console.log(JSON.stringify(character, null, 2))
        print(character)
        continue
      }

      print(character, await saveGeneratedCharacter(character))
    }
    catch (error) {
      failed++

      const reason = error instanceof GenerateRequestError || error instanceof GenerationError
        ? error.violations.join("; ")
        : (error as Error).message

      console.error(`seed ${seed} failed: ${reason}`)
    }
  }

  console.log(`Done: ${count - failed} ${dryRun ? "generated" : "saved"}, ${failed} failed`)

  if (failed > 0) {
    process.exitCode = 1
  }
})
