import type { Note } from '../types'
import { db } from '../db/schema'

// Worker is created lazily on first use — avoids spawning it (and loading
// @xenova/transformers) until the user actually types or searches.
let worker: Worker | null = null

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../workers/embedding.worker.ts', import.meta.url), { type: 'module' })
  }
  return worker
}

function runWorker(id: string, text: string): Promise<number[]> {
  return new Promise((resolve) => {
    const w = getWorker()
    const listener = (event: MessageEvent<{ id: string; embedding: number[] }>) => {
      if (event.data.id !== id) return
      w.removeEventListener('message', listener)
      resolve(event.data.embedding)
    }
    w.addEventListener('message', listener)
    w.postMessage({ id, text })
  })
}

async function hashText(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Returns the embedding for `text`, using the cached value from IndexedDB when
 * the content hasn't changed — avoiding an AI model invocation entirely.
 */
export async function embedText(id: string, text: string): Promise<{ id: string; embedding: number[] }> {
  const hash = await hashText(text)

  // Check IndexedDB cache first (skip semantic-query lookups — those are transient)
  if (id !== 'semantic-query' && id !== 'chat-query') {
    const record = await db.embeddings.get(id)
    if (record && record.contentHash === hash && record.data.length > 0) {
      return { id, embedding: record.data }
    }
  }

  const embedding = await runWorker(id, text)
  return { id, embedding }
}

export async function embedNote(note: Note): Promise<number[]> {
  const joined = `${note.title}\n\n${note.content}`
  const result = await embedText(note.id, joined)
  return result.embedding
}
