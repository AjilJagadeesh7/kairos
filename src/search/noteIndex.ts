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

const SEARCH_CACHE_DB   = 'mindvault-search-cache'
const SEARCH_CACHE_STORE = 'index'
const SEARCH_CACHE_KEY   = 'minisearch'

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

async function loadIndexFromCache(): Promise<boolean> {
  try {
    const db    = await openCacheDB()
    const tx    = db.transaction(SEARCH_CACHE_STORE, 'readonly')
    const store = tx.objectStore(SEARCH_CACHE_STORE)
    const result: unknown = await new Promise((res, rej) => {
      const req = store.get(SEARCH_CACHE_KEY)
      req.onsuccess = () => res(req.result)
      req.onerror   = () => rej(req.error)
    })
    db.close()
    if (!result) return false
    index = MiniSearch.loadJS<IndexDoc>(result as string, INDEX_OPTIONS)
    indexed = true
    return true
  } catch {
    return false
  }
}

function saveIndexToCache(): void {
  // Fire-and-forget — don't block the caller
  void (async () => {
    try {
      const serialized = JSON.stringify(index)
      const db    = await openCacheDB()
      const tx    = db.transaction(SEARCH_CACHE_STORE, 'readwrite')
      const store = tx.objectStore(SEARCH_CACHE_STORE)
      store.put(serialized, SEARCH_CACHE_KEY)
      await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error) })
      db.close()
    } catch { /* persistence is best-effort */ }
  })()
}

// Attempt to restore from cache on module load so search works before buildIndex
void loadIndexFromCache()

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

/** Rebuild the whole index from scratch (called after full content load). */
export function buildIndex(notes: Note[]): void {
  if (indexed) index.removeAll()
  index.addAll(notes.map(toDoc))
  indexed = true
  saveIndexToCache()
}

/** Add or update a single note in the index. */
export function indexNote(note: Note): void {
  if (!indexed) return
  try { index.discard(note.id) } catch { /* not present */ }
  index.add(toDoc(note))
  saveIndexToCache()
}

/** Remove a note from the index. */
export function deindexNote(noteId: string): void {
  if (!indexed) return
  try { index.discard(noteId) } catch { /* not present */ }
  saveIndexToCache()
}

export interface SearchResult {
  id: string
  score: number
  terms: string[]
}

/** Run a query and return ranked note IDs. Empty query → empty array. */
export function searchNotes(query: string): SearchResult[] {
  if (!query.trim() || !indexed) return []
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
