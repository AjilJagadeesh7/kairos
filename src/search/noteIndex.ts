/**
 * Incremental full-text search index built on MiniSearch.
 * Supports fuzzy matching, prefix completion, and per-field boosting.
 *
 * The index is a module-level singleton — it persists across renders and is
 * shared by every hook that calls into it.
 */
import MiniSearch from 'minisearch'
import type { Note } from '../types'

type IndexDoc = {
  id: string
  title: string
  content: string
  tags: string
}

const index = new MiniSearch<IndexDoc>({
  fields: ['title', 'content', 'tags'],
  storeFields: ['id'],
  searchOptions: {
    boost: { title: 3, tags: 2 },
    fuzzy: 0.2,
    prefix: true,
    combineWith: 'AND',
  },
})

let indexed = false

function toDoc(note: Note): IndexDoc {
  return {
    id: note.id,
    title: note.title || 'Untitled note',
    content: note.content.slice(0, 8000),
    tags: note.tags.join(' '),
  }
}

/** Rebuild the whole index from scratch (called after initial note load). */
export function buildIndex(notes: Note[]): void {
  if (indexed) index.removeAll()
  index.addAll(notes.map(toDoc))
  indexed = true
}

/** Add or update a single note in the index. */
export function indexNote(note: Note): void {
  if (!indexed) return
  try { index.discard(note.id) } catch { /* not present */ }
  index.add(toDoc(note))
}

/** Remove a note from the index. */
export function deindexNote(noteId: string): void {
  if (!indexed) return
  try { index.discard(noteId) } catch { /* not present */ }
}

export interface SearchResult {
  id: string
  score: number
  /** Which fields contained matches */
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
