export type QueueOptions<T> = {
  worker: (item: T, signal: AbortSignal) => Promise<void>
  // Parallel workers
  concurrency?: number
  // Extra attempts after the first failure; errors with `retryable === false` are never retried
  retries?: number
  // Delay before retry n is retryDelayMs * 2^(n-1)
  retryDelayMs?: number
  onSuccess?: (item: T) => void
  onFailure?: (item: T, error: unknown) => void
}

export type QueueReport<T> = {
  succeeded: T[]
  failed: { item: T, error: unknown }[]
}

export type Queue<T> = {
  /** Adds items; ones that are already pending or running are skipped. Returns how many were added */
  push: (items: Iterable<T>) => number
  /** Resolves once every pushed item is done, with the results gathered since the last drain */
  drain: () => Promise<QueueReport<T>>
  /** Drops pending items and aborts running workers */
  stop: () => void
  readonly size: number
  readonly running: number
}

const isRetryable = (error: unknown) =>
  !(typeof error === "object" && error !== null && "retryable" in error && error.retryable === false)

const wait = (ms: number, signal: AbortSignal) => new Promise<void>((resolve) => {
  const timer = setTimeout(resolve, ms)

  signal.addEventListener("abort", () => {
    clearTimeout(timer)
    resolve()
  }, { once: true })
})

/**
 * In-memory FIFO queue with a concurrency limit and exponential-backoff retries.
 * Items are compared by value (Set semantics), so pass primitives such as ids.
 */
export const createQueue = <T>({
  worker,
  concurrency = 4,
  retries = 3,
  retryDelayMs = 500,
  onSuccess,
  onFailure
}: QueueOptions<T>): Queue<T> => {
  if (concurrency < 1) {
    throw new Error("concurrency must be >= 1")
  }

  const pending: T[] = []
  const queued = new Set<T>()
  let running = 0
  let controller = new AbortController()
  let report: QueueReport<T> = { succeeded: [], failed: [] }
  let waiters: ((report: QueueReport<T>) => void)[] = []

  const settleIfIdle = () => {
    if (running > 0 || pending.length > 0 || waiters.length === 0) {
      return
    }

    const done = report
    const resolvers = waiters

    report = { succeeded: [], failed: [] }
    waiters = []
    resolvers.forEach(resolve => resolve(done))
  }

  const run = async (item: T) => {
    const { signal } = controller

    for (let attempt = 0; ; attempt++) {
      try {
        await worker(item, signal)
        report.succeeded.push(item)
        onSuccess?.(item)

        return
      }
      catch (error) {
        if (signal.aborted || attempt >= retries || !isRetryable(error)) {
          report.failed.push({ item, error })
          onFailure?.(item, error)

          return
        }

        await wait(retryDelayMs * 2 ** attempt, signal)
      }
    }
  }

  const next = () => {
    while (running < concurrency && pending.length > 0) {
      const item = pending.shift()!

      running++

      void run(item).finally(() => {
        running--
        queued.delete(item)
        next()
        settleIfIdle()
      })
    }
  }

  return {
    push(items) {
      let added = 0

      for (const item of items) {
        if (!queued.has(item)) {
          queued.add(item)
          pending.push(item)
          added++
        }
      }

      next()

      return added
    },
    drain() {
      return new Promise((resolve) => {
        waiters.push(resolve)
        settleIfIdle()
      })
    },
    stop() {
      for (const item of pending.splice(0)) {
        queued.delete(item)
      }

      controller.abort()
      controller = new AbortController()
      settleIfIdle()
    },
    get size() {
      return pending.length
    },
    get running() {
      return running
    }
  }
}
