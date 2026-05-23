// Singleton client for the cosine similarity Web Worker.
// Keyed cache avoids recomputing when embeddings haven't changed.

let worker: Worker | null = null

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL('../workers/similarity.worker.ts', import.meta.url),
      { type: 'module' },
    )
  }
  return worker
}

// Terminate the worker when the page unloads to avoid dangling background threads.
if (typeof window !== 'undefined') {
  window.addEventListener('unload', () => {
    worker?.terminate()
    worker = null
  })
}

let cachedFingerprint = ''
let cachedResult: Array<{ source: string; target: string }> = []

function fingerprint(map: Map<string, number[]>): string {
  const keys = Array.from(map.keys()).sort()
  // Use keys + first value element as a cheap change signal
  return keys.map(k => `${k}:${map.get(k)?.[0] ?? ''}`).join('|')
}

let pendingReject: ((reason?: unknown) => void) | null = null

export function computeSimilarityPairs(
  embeddingMap: Map<string, number[]>,
  threshold = 0.75,
): Promise<Array<{ source: string; target: string }>> {
  if (embeddingMap.size < 2) return Promise.resolve([])

  const fp = fingerprint(embeddingMap)
  if (fp === cachedFingerprint) return Promise.resolve(cachedResult)

  // Cancel any in-flight computation
  if (pendingReject) {
    pendingReject(new DOMException('Cancelled', 'AbortError'))
    pendingReject = null
  }

  return new Promise((resolve, reject) => {
    pendingReject = reject
    const w = getWorker()
    const embeddings = Array.from(embeddingMap.entries()).map(([id, data]) => ({ id, data }))

    const onMessage = (e: MessageEvent<{ pairs: Array<{ source: string; target: string }> }>) => {
      w.removeEventListener('message', onMessage)
      w.removeEventListener('error', onError)
      pendingReject = null
      cachedFingerprint = fp
      cachedResult = e.data.pairs
      resolve(e.data.pairs)
    }
    const onError = (e: ErrorEvent) => {
      w.removeEventListener('message', onMessage)
      w.removeEventListener('error', onError)
      pendingReject = null
      reject(e)
    }

    w.addEventListener('message', onMessage)
    w.addEventListener('error', onError)
    w.postMessage({ embeddings, threshold })
  })
}
