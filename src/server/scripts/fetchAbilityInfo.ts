import { listAbilityNames } from "@/server/db/queries/saveAbility"
import { createAbilityQueue } from "@/server/pokemon-info/abilityQueue"
import { INFO_SOURCES } from "@/server/pokemon-info/sources"
import { parseCliArgs, runQueueCli, runScript } from "./utils/runQueueCli"

const USAGE = `Usage: npm run ability:info -- <abilities...> [--concurrency=N]
  <abilities>  PokeAPI ability names or ids: static lightning-rod 9
  --all        every ability listed in pokemon_info.abilities
  --missing    like --all, but only abilities not downloaded yet`

const ABILITY_ARG = /^[a-z0-9-]+$/

runScript(async () => {
  const { flags, values, concurrency } = parseCliArgs()

  const invalid = values.find(value => !ABILITY_ARG.test(value))

  if (invalid) {
    throw new Error(`Invalid ability name or id: "${invalid}"`)
  }

  const abilities = flags.has("--all") || flags.has("--missing")
    ? await listAbilityNames(INFO_SOURCES.pokeapi, { onlyMissing: flags.has("--missing") })
    : [...new Set(values)]

  if (abilities.length === 0) {
    console.log(USAGE)

    return
  }

  await runQueueCli(abilities, callbacks => createAbilityQueue({ concurrency, ...callbacks }))
})
