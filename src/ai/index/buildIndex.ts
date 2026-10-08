/**
 * Builds or updates the semantic index. Incremental: a document whose hash
 * and embedding model are unchanged is skipped, so a paused build resumes
 * where it stopped and a re-index after an edit only embeds that note.
 * Storage and the embedder are passed in, so tests run without IndexedDB.
 */
import { chunkDoc, docKey, embedInput, type IndexDoc } from './indexDocs'
import type { IndexChunk } from '../../types'

export interface IndexStorage {
  /** docKey → { hash, modelId } of what is stored now. */
  state(): Promise<Map<string, { hash: string; modelId?: string }>>
  /** Replaces every chunk of one document. */
  put(key: string, chunks: IndexChunk[]): Promise<void>
  remove(keys: string[]): Promise<void>
}

export interface BuildProgress { done: number; total: number }

export interface BuildResult {
  embedded: number
  skipped: number
  removed: number
  /** True when `shouldStop` ended the run early (pause). */
  stopped: boolean
}

/** Unit length, so a dot product is the cosine similarity. */
export function normalize(v: ArrayLike<number>): Float32Array {
  let n = 0
  for (let i = 0; i < v.length; i++) n += v[i] * v[i]
  const len = Math.sqrt(n) || 1
  const out = new Float32Array(v.length)
  for (let i = 0; i < v.length; i++) out[i] = v[i] / len
  return out
}

export async function buildIndex(opts: {
  docs: IndexDoc[]
  storage: IndexStorage
  /** null = keyword-only: chunks are stored without vectors. */
  embed: ((text: string) => Promise<number[]>) | null
  modelId: string | null
  onProgress?: (p: BuildProgress) => void
  shouldStop?: () => boolean
  /** Only these documents (docKeys); the rest are left alone. Default: all, and stale ones removed. */
  only?: Set<string>
}): Promise<BuildResult> {
  const { docs, storage, embed, modelId } = opts
  const stored = await storage.state()
  const wanted = opts.only ? docs.filter((d) => opts.only!.has(docKey(d))) : docs
  const result: BuildResult = { embedded: 0, skipped: 0, removed: 0, stopped: false }

  if (!opts.only) {
    const live = new Set(docs.map(docKey))
    const gone = [...stored.keys()].filter((k) => !live.has(k))
    if (gone.length) await storage.remove(gone)
    result.removed = gone.length
  } else {
    // A requested document that no longer exists (deleted note) is removed.
    const present = new Set(wanted.map(docKey))
    const gone = [...opts.only].filter((k) => !present.has(k) && stored.has(k))
    if (gone.length) await storage.remove(gone)
    result.removed = gone.length
  }

  for (let i = 0; i < wanted.length; i++) {
    if (opts.shouldStop?.()) { result.stopped = true; break }
    const doc = wanted[i]
    const chunks = chunkDoc(doc)
    const have = stored.get(docKey(doc))
    if (have && have.hash === chunks[0]?.hash && (have.modelId ?? null) === (embed ? modelId : null)) {
      result.skipped++
    } else {
      const out: IndexChunk[] = []
      for (const c of chunks) {
        if (!embed) { out.push(c); continue }
        const v = await embed(embedInput(c))
        // An empty vector means the model failed on this chunk; keep it keyword-searchable.
        out.push(v.length ? { ...c, vector: normalize(v), modelId: modelId ?? undefined } : c)
      }
      await storage.put(docKey(doc), out)
      result.embedded++
    }
    opts.onProgress?.({ done: i + 1, total: wanted.length })
  }
  return result
}
