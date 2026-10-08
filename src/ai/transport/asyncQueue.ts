/** Push-to-pull bridge: native events push chunks, consumers `for await` them. */
export interface AsyncQueue<T> extends AsyncIterable<T> {
  push(value: T): void
  /** Ends iteration after already-queued values are consumed. */
  close(): void
  /** Ends iteration with an error after already-queued values are consumed. */
  fail(err: unknown): void
}

export function createAsyncQueue<T>(): AsyncQueue<T> {
  const values: T[] = []
  let done = false
  let error: unknown = null
  let wake: (() => void) | null = null

  const notify = () => { const w = wake; wake = null; w?.() }

  return {
    push(value) {
      if (done) return
      values.push(value)
      notify()
    },
    close() {
      done = true
      notify()
    },
    fail(err) {
      if (done) return
      error = err ?? new Error('stream failed')
      done = true
      notify()
    },
    async *[Symbol.asyncIterator]() {
      for (;;) {
        if (values.length > 0) { yield values.shift() as T; continue }
        if (done) {
          if (error) throw error
          return
        }
        await new Promise<void>((resolve) => { wake = resolve })
      }
    },
  }
}
