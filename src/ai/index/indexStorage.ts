/**
 * The semantic index in IndexedDB (`aiChunks`). Device-local and never
 * synced: it is derived from the vault and can always be rebuilt.
 */
import { db } from '../../db/schema'
import type { IndexStorage } from './buildIndex'
import type { IndexChunk } from '../../types'

/** The on-device embedder (MiniLM via transformers.js; works in both builds). */
export const ON_DEVICE_MODEL = 'Xenova/all-MiniLM-L6-v2'

const keyOf = (c: Pick<IndexChunk, 'kind' | 'docId'>) => `${c.kind}:${c.docId}`

export const dexieIndexStorage: IndexStorage = {
  async state() {
    const out = new Map<string, { hash: string; modelId?: string }>()
    await db.aiChunks.each((c) => {
      if (!out.has(keyOf(c))) out.set(keyOf(c), { hash: c.hash, modelId: c.modelId })
    })
    return out
  },
  async put(key, chunks) {
    const docId = key.slice(key.indexOf(':') + 1)
    await db.transaction('rw', db.aiChunks, async () => {
      const old = await db.aiChunks.where('docId').equals(docId).filter((c) => keyOf(c) === key).primaryKeys()
      await db.aiChunks.bulkDelete(old)
      await db.aiChunks.bulkPut(chunks)
    })
  },
  async remove(keys) {
    const set = new Set(keys)
    const ids = await db.aiChunks.filter((c) => set.has(keyOf(c))).primaryKeys()
    await db.aiChunks.bulkDelete(ids)
  },
}

export async function loadIndexedChunks(): Promise<IndexChunk[]> {
  return db.aiChunks.toArray()
}

export async function indexStats(): Promise<{ chunks: number; docs: number; bytes: number; modelIds: string[] }> {
  let chunks = 0
  let bytes = 0
  const docs = new Set<string>()
  const models = new Set<string>()
  await db.aiChunks.each((c) => {
    chunks++
    docs.add(keyOf(c))
    bytes += c.text.length * 2 + (c.vector?.byteLength ?? 0) + 200
    if (c.modelId) models.add(c.modelId)
  })
  return { chunks, docs: docs.size, bytes, modelIds: [...models] }
}

export async function clearIndex(): Promise<void> {
  await db.aiChunks.clear()
}
