/**
 * Frontend bridge to Tauri's Tantivy full-text search commands.
 * Desktop-only — returns null on web/mobile so callers fall back to MiniSearch.
 */
import { isDesktop } from '../utils/platform'
import type { Note } from '../types'

export interface TauriSearchHit {
  id: string
  score: number
}

let available: boolean | null = null   // null = not yet checked

async function checkAvailable(): Promise<boolean> {
  if (available !== null) return available
  if (!isDesktop()) { available = false; return false }
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('search_fulltext', { query: '' })
    available = true
  } catch {
    available = false
  }
  return available
}

/** Build the Tantivy index from all notes. Call after phase-2 content load. */
export async function buildTauriIndex(notes: Note[]): Promise<void> {
  if (!await checkAvailable()) return
  const { invoke } = await import('@tauri-apps/api/core')
  const docs = notes.map(n => ({
    id:      n.id,
    title:   n.title || 'Untitled note',
    content: n.content,
    tags:    n.tags.join(' '),
  }))
  await invoke('build_search_index', { notes: docs }).catch(err => {
    console.warn('[tantivy] build failed:', err)
    available = false   // disable for this session
  })
}

/** Update a single note in the Tantivy index. Call after each save. */
export async function updateTauriIndex(note: Note): Promise<void> {
  if (!available) return
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('update_note_index', {
    note: { id: note.id, title: note.title || 'Untitled note', content: note.content, tags: note.tags.join(' ') },
  }).catch(() => {})
}

/** Remove a note from the Tantivy index. Call after delete. */
export async function removeTauriIndex(noteId: string): Promise<void> {
  if (!available) return
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('remove_note_index', { id: noteId }).catch(() => {})
}

/**
 * Search using Tantivy. Returns null if unavailable (caller uses MiniSearch).
 * Results are sorted by score descending.
 */
export async function searchTauri(query: string): Promise<TauriSearchHit[] | null> {
  if (!query.trim()) return null
  if (!await checkAvailable()) return null
  const { invoke } = await import('@tauri-apps/api/core')
  try {
    return await invoke<TauriSearchHit[]>('search_fulltext', { query })
  } catch {
    return null
  }
}
