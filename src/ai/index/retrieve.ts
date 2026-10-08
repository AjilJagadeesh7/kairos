/**
 * Hybrid retrieval for the global chat (PRD): keyword match over title, tags
 * and text, fused with vector similarity from the semantic index when one is
 * built (reciprocal-rank fusion). Keyword search runs on the vault as it is
 * now, so it never misses a note the index hasn't caught up with; vectors of
 * a note that changed since it was indexed are ignored until it's re-indexed.
 */
import MiniSearch from 'minisearch'
import { chunkDoc, docKey, vaultDocs, type IndexDoc } from './indexDocs'
import type { IndexChunk, RetrievedChunk, RetrieveFilter, VaultSnapshot } from '../../types'

export const RETRIEVE_LIMIT = 8
const PER_DOC = 3
const RRF_K = 60

// Chunks per document, re-chunked only when the document changes.
const chunkCache = new Map<string, { updatedAt: string; chunks: IndexChunk[] }>()
let search: { signature: string; engine: MiniSearch<IndexChunk>; byId: Map<string, IndexChunk> } | null = null

function chunksOf(doc: IndexDoc): IndexChunk[] {
  const key = docKey(doc)
  const hit = chunkCache.get(key)
  if (hit && hit.updatedAt === doc.updatedAt) return hit.chunks
  const chunks = chunkDoc(doc)
  chunkCache.set(key, { updatedAt: doc.updatedAt, chunks })
  return chunks
}

function keywordEngine(docs: IndexDoc[]) {
  const signature = `${docs.length}:${docs.map((d) => d.updatedAt).sort().at(-1) ?? ''}:${docs.reduce((n, d) => n + d.text.length, 0)}`
  if (search?.signature === signature) return search
  const all = docs.flatMap(chunksOf)
  const engine = new MiniSearch<IndexChunk>({
    fields: ['title', 'heading', 'tagText', 'text'],
    extractField: (doc, field) => (field === 'tagText' ? doc.tags.join(' ') : String((doc as unknown as Record<string, unknown>)[field] ?? '')),
    searchOptions: { boost: { title: 3, tagText: 2, heading: 2, text: 1 }, fuzzy: 0.15, prefix: true, combineWith: 'OR' },
  })
  engine.addAll(all)
  search = { signature, engine, byId: new Map(all.map((c) => [c.id, c])) }
  return search
}

function passes(doc: Pick<IndexChunk, 'updatedAt' | 'tags'>, filter: RetrieveFilter): boolean {
  if (filter.since && doc.updatedAt < filter.since) return false
  if (filter.tags?.length && !filter.tags.some((t) => doc.tags.map((x) => x.toLowerCase()).includes(t.toLowerCase()))) return false
  return true
}

function dot(a: Float32Array, b: Float32Array): number {
  let s = 0
  for (let i = 0; i < a.length && i < b.length; i++) s += a[i] * b[i]
  return s
}

export async function retrieve(query: string, filter: RetrieveFilter, opts: {
  vault: VaultSnapshot
  /** Stored chunks with vectors, or null in keyword-only mode. */
  indexed: (() => Promise<IndexChunk[]>) | null
  /** Unit-length query vector for `modelId`, or null. */
  embedQuery: ((q: string) => Promise<Float32Array | null>) | null
  modelId: string | null
  limit?: number
}): Promise<{ chunks: RetrievedChunk[]; mode: 'hybrid' | 'keyword' }> {
  const docs = vaultDocs(opts.vault)
  const { engine, byId } = keywordEngine(docs)
  const ranks = new Map<string, number>()
  const add = (ids: string[]) => ids.forEach((id, i) => ranks.set(id, (ranks.get(id) ?? 0) + 1 / (RRF_K + i + 1)))

  add(engine.search(query).map((r) => String(r.id)).filter((id) => passes(byId.get(id)!, filter)).slice(0, 50))

  let mode: 'hybrid' | 'keyword' = 'keyword'
  if (opts.indexed && opts.embedQuery) {
    const [stored, q] = await Promise.all([opts.indexed(), opts.embedQuery(query)])
    if (q) {
      const scored = stored
        // Only vectors from this model, for text that is still current.
        .filter((c) => c.vector && c.modelId === opts.modelId && byId.get(c.id)?.hash === c.hash && passes(c, filter))
        .map((c) => ({ id: c.id, s: dot(c.vector!, q) }))
        .sort((a, b) => b.s - a.s)
        .slice(0, 50)
      // Only call it hybrid when some current vector actually took part.
      if (scored.length) mode = 'hybrid'
      add(scored.map((x) => x.id))
    }
  }

  const perDoc = new Map<string, number>()
  const out: RetrievedChunk[] = []
  for (const [id, score] of [...ranks].sort((a, b) => b[1] - a[1])) {
    const c = byId.get(id)
    if (!c) continue
    const key = `${c.kind}:${c.docId}`
    if ((perDoc.get(key) ?? 0) >= PER_DOC) continue
    perDoc.set(key, (perDoc.get(key) ?? 0) + 1)
    const { vector: _v, ...rest } = c
    out.push({ ...rest, score })
    if (out.length >= (opts.limit ?? RETRIEVE_LIMIT)) break
  }
  return { chunks: out, mode }
}
