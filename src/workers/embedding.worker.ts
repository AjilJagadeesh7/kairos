/// <reference lib="webworker" />

type EmbeddingRequest = {
  id: string
  text: string
}

type EmbeddingResponse = {
  id: string
  embedding: number[]
  /** Why embedding failed (embedding is then empty). */
  error?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let extractor: any = null

async function getExtractor() {
  if (!extractor) {
    // Dynamic import so that ort-web (onnxruntime-web) module-level initialization
    // errors are thrown inside an async context and can be caught, rather than
    // crashing the worker during top-level module evaluation.
    const { pipeline, env } = await import('@xenova/transformers')
    // No bundled model files: without this, transformers.js first asks the app's
    // own server for /models/…, gets the SPA's index.html back, and fails to parse it.
    env.allowLocalModels = false
    extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
  }
  return extractor
}

self.onmessage = async (event: MessageEvent<EmbeddingRequest>) => {
  const { id, text } = event.data
  try {
    const model = (await getExtractor()) as (input: string, options?: Record<string, unknown>) => Promise<unknown>
    const result = (await model(text, { pooling: 'mean' })) as { data?: Float32Array | number[] }
    const embedding = Array.from(result.data ?? [])
    const response: EmbeddingResponse = { id, embedding }
    self.postMessage(response)
  } catch (err) {
    self.postMessage({ id, embedding: [], error: err instanceof Error ? err.message : String(err) } satisfies EmbeddingResponse)
  }
}
