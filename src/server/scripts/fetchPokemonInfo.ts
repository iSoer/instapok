import { listPokemonNumbers } from "@/server/db/queries/savePokemonInfo"
import { createPokemonInfoQueue } from "@/server/pokemon-info/pokemonInfoQueue"
import { parseIds } from "@/server/pokemon-info/parseIds"
import { parseCliArgs, runQueueCli, runScript } from "./utils/runQueueCli"

const USAGE = `Usage: npm run pokemon:info -- <ids...> [--concurrency=N]
  <ids>        PokeAPI ids or ranges: 1 4 7, 1-151
  --all        every pokemon number present in the pokemon table
  --missing    like --all, but only rows without info yet`

runScript(async () => {
  const { flags, values, concurrency } = parseCliArgs()

  const ids = flags.has("--all") || flags.has("--missing")
    ? await listPokemonNumbers({ onlyMissing: flags.has("--missing") })
    : parseIds(values)

  if (ids.length === 0) {
    console.log(USAGE)

    return
  }

  await runQueueCli(ids, callbacks => createPokemonInfoQueue({ concurrency, ...callbacks }), id => `#${id}`)
})
