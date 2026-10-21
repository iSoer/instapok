import { describe, expect, it } from "vitest"
import { createQueue } from "@/server/pokemon-info/createQueue"

class PermanentError extends Error {
  readonly retryable = false
}

const deferred = () => {
  let resolve!: () => void
  const promise = new Promise<void>((r) => {
    resolve = r
  })

  return { promise, resolve }
}

describe("createQueue", () => {
  it("processes every item and never exceeds the concurrency limit", async () => {
    let active = 0
    let maxActive = 0

    const queue = createQueue<number>({
      concurrency: 3,
      worker: async () => {
        active++
        maxActive = Math.max(maxActive, active)
        await new Promise(resolve => setTimeout(resolve, 5))
        active--
      }
    })

    queue.push([1, 2, 3, 4, 5, 6, 7, 8])

    const report = await queue.drain()

    expect(report.succeeded.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(report.failed).toEqual([])
    expect(maxActive).toBe(3)
  })

  it("skips items that are already pending or running", async () => {
    const gate = deferred()
    const seen: number[] = []

    const queue = createQueue<number>({
      concurrency: 1,
      worker: async (item) => {
        seen.push(item)
        await gate.promise
      }
    })

    expect(queue.push([1, 2, 2])).toBe(2)
    expect(queue.push([1, 2, 3])).toBe(1)

    gate.resolve()
    await queue.drain()

    expect(seen).toEqual([1, 2, 3])
  })

  it("retries transient errors with backoff", async () => {
    let calls = 0

    const queue = createQueue<number>({
      retries: 2,
      retryDelayMs: 1,
      worker: async () => {
        calls++

        if (calls < 3) {
          throw new Error("flaky")
        }
      }
    })

    queue.push([1])

    expect(await queue.drain()).toEqual({ succeeded: [1], failed: [] })
    expect(calls).toBe(3)
  })

  it("gives up after the last retry and does not retry permanent errors", async () => {
    const calls: Record<number, number> = {}

    const queue = createQueue<number>({
      retries: 2,
      retryDelayMs: 1,
      worker: async (item) => {
        calls[item] = (calls[item] ?? 0) + 1
        throw item === 1 ? new Error("down") : new PermanentError("404")
      }
    })

    queue.push([1, 2])

    const { succeeded, failed } = await queue.drain()

    expect(succeeded).toEqual([])
    expect(failed.map(({ item }) => item).sort()).toEqual([1, 2])
    expect(calls).toEqual({ 1: 3, 2: 1 })
  })

  it("drain resolves immediately when the queue is empty", async () => {
    const queue = createQueue<number>({ worker: async () => {} })

    expect(await queue.drain()).toEqual({ succeeded: [], failed: [] })
  })

  it("stop drops pending items and aborts running workers", async () => {
    const queue = createQueue<number>({
      concurrency: 1,
      worker: (_, signal) => new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")))
      })
    })

    queue.push([1, 2, 3])
    queue.stop()

    const { succeeded, failed } = await queue.drain()

    expect(succeeded).toEqual([])
    expect(failed.map(({ item }) => item)).toEqual([1])
    expect(queue.size).toBe(0)
  })
})
