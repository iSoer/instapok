import { saveGeneratedPokemon } from "@/server/db/queries/saveGeneratedPokemon"
import {
  GenerateRequestError, GenerationError, canHaveMega, generateEvolutionLine, generateMegaForm, generatePokemon,
  type GeneratedPokemon
} from "@/server/pokemon-model/generate"
import { loadModel } from "@/server/pokemon-model/loadModel"
import { randomSeed } from "@/server/pokemon-model/random"
import {
  MAX_SEED, generateLineRequestSchema, generateRequestSchema, type GenerateLineRequestType, type GenerateRequestType
} from "@shared/api/schema/pokemon/generated"
import { runScript } from "./utils/runQueueCli"

const USAGE = `Usage: npm run pokemon:generate -- [options]
  --count=N              how many pokemon or lines (default 1)
  --line=2|3             generate evolution lines of that length
  --mega                 also generate the mega form of the last pokemon
  --types=fire,flying    --class=stage --stage=3/3 --archetype=tank --abilities=blaze,solar-power --bst=520
  --seed=S               seed of the first pokemon, the next ones get S+1, S+2...
  --dry-run              print JSON and the explanation, do not save`

const KNOWN_OPTIONS = new Set([
  "count", "line", "mega", "types", "class", "stage", "archetype", "abilities", "bst", "seed", "dry-run", "help"
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

const stageOf = (value: string | undefined) => {
  if (value === undefined) {
    return undefined
  }

  const [index, of] = value.split("/").map(Number)

  return { index, of }
}

const print = (pokemon: GeneratedPokemon, saved?: { id: string }) => {
  const { stats } = pokemon
  const bst = Object.values(stats).reduce((sum, value) => sum + value, 0)
  const stage = pokemon.stage ? ` ${pokemon.stage.index}/${pokemon.stage.of}` : ""

  console.log(`${pokemon.name}${pokemon.form ? ` (${pokemon.form})` : ""}  ${pokemon.class}${stage}  ${pokemon.types.join("/")}  `
    + `BST ${bst}  ${pokemon.abilities.join(", ")}  seed ${pokemon.seed}${saved ? `  id ${saved.id}` : ""}`)
}

runScript(async () => {
  const options = parseOptions(process.argv.slice(2))

  if (options.has("help")) {
    console.log(USAGE)

    return
  }

  const model = loadModel()
  const count = integer("count", options.get("count"), 1)
  const firstSeed = integer("seed", options.get("seed"), randomSeed())
  const dryRun = options.has("dry-run")
  const length = options.get("line")
  const fields = {
    types: list(options.get("types")),
    archetype: options.get("archetype"),
    abilities: list(options.get("abilities"))
  }

  const lineRequest: GenerateLineRequestType | undefined = length === undefined
    ? undefined
    : generateLineRequestSchema.parse({ length: Number(length), ...fields })
  const request: GenerateRequestType = generateRequestSchema.parse({
    ...fields,
    class: options.get("class"),
    stage: stageOf(options.get("stage")),
    bst: options.has("bst") ? Number(options.get("bst")) : undefined
  })

  let failed = 0

  for (let i = 0; i < count; i++) {
    const seed = (firstSeed + i) % (MAX_SEED + 1)

    try {
      const items = lineRequest ? generateEvolutionLine(model, lineRequest, seed) : [generatePokemon(model, request, seed)]
      const last = items.at(-1)!

      if (options.has("mega")) {
        if (!canHaveMega(last)) {
          throw new GenerateRequestError([`${last.name} (${last.class}) cannot have a mega form`])
        }

        items.push(generateMegaForm(model, last, seed))
      }

      if (dryRun) {
        console.log(JSON.stringify(items, null, 2))
        continue
      }

      // The mega form is saved with the line: its parent is the previous item, the base pokemon
      const saved = await saveGeneratedPokemon(items)

      items.forEach((item, j) => print(item, saved[j]))
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
