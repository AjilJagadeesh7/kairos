/**
 * Incremental full-text search index built on MiniSearch.
 * Supports fuzzy matching, prefix completion, and per-field boosting.
 *
 * The index is a module-level singleton — it persists across renders and is
 * shared by every hook that calls into it.
 *
 * Persistence: the serialized index is stored in IndexedDB (via a raw IDBDatabase,
 * not Dexie, to avoid circular imports). On startup we restore from the cache so
 * search is immediately available; after a full rebuild we write the new snapshot.
 */
import MiniSearch from 'minisearch'
import type { Note } from '../types'

type IndexDoc = {
  id: string
  title: string
  content: string
  tags: string
}

const SEARCH_CACHE_DB    = 'kairos-search-cache'
const SEARCH_CACHE_STORE = 'index'
const SEARCH_CACHE_KEY   = 'minisearch'
const INDEXED_META_KEY   = 'indexed-meta'   // Map<id, updatedAt> snapshot

// --------------------------------------------------------------------------
// MiniSearch singleton
// --------------------------------------------------------------------------

const INDEX_OPTIONS = {
  fields: ['title', 'content', 'tags'],
  storeFields: ['id'],
  searchOptions: {
    boost: { title: 3, tags: 2 },
    fuzzy: 0.2,
    prefix: true,
    combineWith: 'AND' as const,
  },
}

let index = new MiniSearch<IndexDoc>(INDEX_OPTIONS)
let indexed = false

function toDoc(note: Note): IndexDoc {
  return {
    id: note.id,
    title: note.title || 'Untitled note',
    content: note.content.slice(0, 8000),
    tags: note.tags.join(' '),
  }
}

// --------------------------------------------------------------------------
// IndexedDB helpers (raw IDB — no Dexie dependency)
// --------------------------------------------------------------------------

function openCacheDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SEARCH_CACHE_DB, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(SEARCH_CACHE_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

async function idbGet(key: string): Promise<unknown> {
  const db    = await openCacheDB()
  const tx    = db.transaction(SEARCH_CACHE_STORE, 'readonly')
  const store = tx.objectStore(SEARCH_CACHE_STORE)
  const result = await new Promise<unknown>((res, rej) => {
    const req = store.get(key); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error)
  })
  db.close()
  return result
}

async function idbPut(key: string, value: unknown): Promise<void> {
  const db    = await openCacheDB()
  const tx    = db.transaction(SEARCH_CACHE_STORE, 'readwrite')
  const store = tx.objectStore(SEARCH_CACHE_STORE)
  store.put(value, key)
  await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error) })
  db.close()
}

async function loadIndexFromCache(): Promise<boolean> {
  try {
    const result = await idbGet(SEARCH_CACHE_KEY)
    if (!result) return false
    index = MiniSearch.loadJS<IndexDoc>(JSON.parse(result as string) as Parameters<typeof MiniSearch.loadJS>[0], INDEX_OPTIONS)
    indexed = true
    return true
  } catch {
    return false
  }
}

function saveIndexToCache(): void {
  void (async () => {
    try { await idbPut(SEARCH_CACHE_KEY, JSON.stringify(index)) } catch { /* best-effort */ }
  })()
}

// Attempt to restore from cache on module load so search works before buildIndex
void loadIndexFromCache()

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

/** Build or incrementally update the index after phase-2 content load. */
export function buildIndex(notes: Note[]): void {
  // Run the (potentially heavy) work async so it doesn't block the caller
  void (async () => {
    try {
      // Load the last-indexed metadata snapshot
      const snapRaw = await idbGet(INDEXED_META_KEY).catch(() => null)
      const snap: Record<string, string> = snapRaw && typeof snapRaw === 'string'
        ? JSON.parse(snapRaw) as Record<string, string>
        : {}

      const currentIds = new Set(notes.map(n => n.id))

      if (indexed && Object.keys(snap).length > 0) {
        // Incremental path: only re-index notes that changed or are new
        const changed = notes.filter(n => snap[n.id] !== n.updatedAt)
        const removed = Object.keys(snap).filter(id => !currentIds.has(id))

        for (const id of removed) { try { index.discard(id) } catch { /**/ } }
        for (const n of changed) {
          try { index.discard(n.id) } catch { /**/ }
          index.add(toDoc(n))
        }
      } else {
        // Full rebuild (first run or cache miss)
        if (indexed) index.removeAll()
        index.addAll(notes.map(toDoc))
        indexed = true
      }

      // Persist snapshot of indexed IDs → updatedAt
      const newSnap: Record<string, string> = {}
      for (const n of notes) newSnap[n.id] = n.updatedAt
      saveIndexToCache()
      void idbPut(INDEXED_META_KEY, JSON.stringify(newSnap)).catch(() => {})
    } catch {
      // Fallback: full rebuild
      if (indexed) index.removeAll()
      index.addAll(notes.map(toDoc))
      indexed = true
      saveIndexToCache()
    }

    // Also build native Tantivy index on desktop (faster, no JS overhead)
    void import('./tauriSearch').then(({ buildTauriIndex }) => buildTauriIndex(notes))
  })()
}

/** Add or update a single note in the index. */
export function indexNote(note: Note): void {
  if (!indexed) return
  try { index.discard(note.id) } catch { /* not present */ }
  index.add(toDoc(note))
  saveIndexToCache()
  void import('./tauriSearch').then(({ updateTauriIndex }) => updateTauriIndex(note))
}

/** Remove a note from the index. */
export function deindexNote(noteId: string): void {
  if (!indexed) return
  try { index.discard(noteId) } catch { /* not present */ }
  saveIndexToCache()
  void import('./tauriSearch').then(({ removeTauriIndex }) => removeTauriIndex(noteId))
}

export interface SearchResult {
  id: string
  score: number
  terms: string[]
}

/** Run a query via Tantivy (desktop) or MiniSearch (web/mobile). */
export async function searchNotes(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return []
  // Try native Tantivy first
  try {
    const { searchTauri } = await import('./tauriSearch')
    const hits = await searchTauri(query)
    if (hits) return hits.map(h => ({ id: h.id, score: h.score, terms: [] }))
  } catch { /* fall through */ }
  // MiniSearch fallback
  if (!indexed) return []
  try {
    return index.search(query).map(r => ({
      id: r.id as string,
      score: r.score,
      terms: r.terms as string[],
    }))
  } catch {
    return []
  }
}

export function isIndexReady(): boolean {
  return indexed
}
