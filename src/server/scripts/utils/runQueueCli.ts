import { Pool } from "pg"
import { db } from "@db"
import type { Queue, QueueOptions } from "@/server/pokemon-info/createQueue"

export type CliArgs = {
  flags: Set<string>
  // Arguments that are not --flags
  values: string[]
  concurrency: number
}

export const parseCliArgs = (args = process.argv.slice(2), defaultConcurrency = 4): CliArgs => {
  const flags = new Set(args.filter(arg => arg.startsWith("--")))
  const concurrencyFlag = [...flags].find(flag => flag.startsWith("--concurrency="))
  const concurrency = concurrencyFlag ? Number(concurrencyFlag.split("=")[1]) : defaultConcurrency

  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error(`Invalid ${concurrencyFlag}`)
  }

  return { flags, values: args.filter(arg => !arg.startsWith("--")), concurrency }
}

type ProgressCallbacks<T> = Pick<QueueOptions<T>, "onSuccess" | "onFailure">

/**
 * Runs `items` through the queue built by `createQueue`, printing per-item progress and a summary.
 * Ctrl+C stops the queue; any failure sets exit code 1.
 */
export const runQueueCli = async <T>(
  items: T[],
  createQueue: (callbacks: ProgressCallbacks<T>) => Queue<T>,
  format: (item: T) => string = String
) => {
  let done = 0

  const queue = createQueue({
    onSuccess: (item) => {
      done++
      console.log(`[${done}/${items.length}] ${format(item)} saved`)
    },
    onFailure: (item, error) => {
      done++
      console.error(`[${done}/${items.length}] ${format(item)} failed: ${(error as Error).message}`)
    }
  })

  const stop = () => {
    console.log("Stopping...")
    queue.stop()
  }

  process.once("SIGINT", stop)
  queue.push(items)

  const { succeeded, failed } = await queue.drain()

  process.off("SIGINT", stop)
  console.log(`Done: ${succeeded.length} saved, ${failed.length} failed`)

  if (failed.length > 0) {
    console.log(`Failed: ${failed.map(({ item }) => item).join(" ")}`)
    process.exitCode = 1
  }
}

/** Runs the script body, reports its error and closes the DB pool so the process can exit */
export const runScript = (main: () => Promise<void>) => main()
  .catch((error) => {
    console.error((error as Error).message)
    process.exitCode = 1
  })
  .finally(async () => {
    if (db.$client instanceof Pool) {
      await db.$client.end()
    }
  })
