import { Pool } from "pg"
import { db } from "@db"
import { listPokemonNumbers } from "@/server/db/queries/savePokemonInfo"
import { createPokemonInfoQueue } from "@/server/pokemon-info/pokemonInfoQueue"
import { parseIds } from "@/server/pokemon-info/parseIds"

const USAGE = `Usage: npm run pokemon:info -- <ids...> [--concurrency=N]
  <ids>        PokeAPI ids or ranges: 1 4 7, 1-151
  --all        every pokemon number present in the pokemon table
  --missing    like --all, but only rows without info yet`

const main = async () => {
  const args = process.argv.slice(2)
  const flags = new Set(args.filter(arg => arg.startsWith("--")))
  const concurrencyFlag = [...flags].find(flag => flag.startsWith("--concurrency="))
  const concurrency = concurrencyFlag ? Number(concurrencyFlag.split("=")[1]) : 4

  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error(`Invalid ${concurrencyFlag}`)
  }

  const ids = flags.has("--all") || flags.has("--missing")
    ? await listPokemonNumbers({ onlyMissing: flags.has("--missing") })
    : parseIds(args.filter(arg => !arg.startsWith("--")))

  if (ids.length === 0) {
    console.log(USAGE)

    return
  }

  let done = 0

  const queue = createPokemonInfoQueue({
    concurrency,
    onSuccess: (id) => {
      done++
      console.log(`[${done}/${ids.length}] #${id} saved`)
    },
    onFailure: (id, error) => {
      done++
      console.error(`[${done}/${ids.length}] #${id} failed: ${(error as Error).message}`)
    }
  })

  process.once("SIGINT", () => {
    console.log("Stopping...")
    queue.stop()
  })

  queue.push(ids)

  const { succeeded, failed } = await queue.drain()

  console.log(`Done: ${succeeded.length} saved, ${failed.length} failed`)

  if (failed.length > 0) {
    console.log(`Failed ids: ${failed.map(({ item }) => item).join(" ")}`)
    process.exitCode = 1
  }
}

main()
  .catch((error) => {
    console.error((error as Error).message)
    process.exitCode = 1
  })
  .finally(async () => {
    if (db.$client instanceof Pool) {
      await db.$client.end()
    }
  })
