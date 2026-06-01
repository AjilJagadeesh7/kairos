/**
 * Per-category serialization + local-persistence adapters for the content types
 * that sync via last-write-wins (journal, kanban, canvas).
 *
 * Notes are NOT here — they keep a richer conflict-detection path in the
 * orchestrator. Settings/secrets are handled by settingsSync.ts.
 */
import type { RemoteBlob } from './remoteProvider'
import type { SyncCategory, JournalEntry } from '../types'
import type { Board } from '../types/kanban.types'
import type { Canvas } from '../types/canvas.types'

/** Content categories that sync as plain last-write-wins blobs. */
export type ContentCategory = 'journal' | 'kanban' | 'canvas'

export interface SyncedItem {
  id: string
  filename: string
  updatedAt: string
  content: string
  noSync: boolean
}

export interface CategoryAdapter {
  category: ContentCategory
  /** Turn a live store object into a pushable blob descriptor. */
  toSynced(item: unknown): SyncedItem
  /** All local items as pushable blobs. */
  listLocal(): Promise<SyncedItem[]>
  /** Parse a remote blob into an item descriptor (content preserved). */
  parse(blob: RemoteBlob): SyncedItem | null
  /** Persist a pulled blob to the local vault. */
  writeLocal(blob: RemoteBlob): Promise<void>
  /** Refresh the in-memory store after pulls. */
  reload(): Promise<void>
}

// ---------------------------------------------------------------------------
// Journal — vault/journal/{date}.md
// ---------------------------------------------------------------------------

const journalAdapter: CategoryAdapter = {
  category: 'journal',
  toSynced(item) {
    const e = item as JournalEntry
    return { id: e.date, filename: `${e.date}.md`, updatedAt: e.updatedAt, content: serializeJournal(e), noSync: !!e.noSync }
  },
  async listLocal() {
    const { readAllJournalEntries } = await import('./plainFolder')
    return (await readAllJournalEntries()).map((e) => journalAdapter.toSynced(e))
  },
  parse(blob) {
    const date = blob.name.replace(/\.md$/, '')
    const e = deserializeJournal(blob.content, date)
    return { id: e.date, filename: blob.name, updatedAt: e.updatedAt, content: blob.content, noSync: !!e.noSync }
  },
  async writeLocal(blob) {
    const { writeJournalEntry } = await import('./plainFolder')
    const date = blob.name.replace(/\.md$/, '')
    await writeJournalEntry(deserializeJournal(blob.content, date))
  },
  async reload() {
    const { useJournalStore } = await import('../store/useJournalStore')
    await useJournalStore.getState().loadEntries()
  },
}

// Sync mirror of plainFolder's journal (de)serializers — kept synchronous so
// toSynced() needn't be async. Both files emit the identical on-disk format.
function serializeJournal(e: JournalEntry): string {
  const fm = [`date: ${e.date}`, `updatedAt: ${e.updatedAt}`]
  if (e.noSync) fm.push('noSync: true')
  return `---\n${fm.join('\n')}\n---\n\n${e.content}`
}
function deserializeJournal(raw: string, fallbackDate: string): JournalEntry {
  if (raw.startsWith('---\n')) {
    const rest = raw.slice(4)
    const closeIdx = rest.indexOf('\n---\n')
    if (closeIdx !== -1) {
      const fmBlock = rest.slice(0, closeIdx)
      const body = rest.slice(closeIdx + 5).replace(/^\n/, '')
      const get = (k: string) => fmBlock.match(new RegExp(`^${k}: (.+)$`, 'm'))?.[1] ?? ''
      const entry: JournalEntry = { date: get('date') || fallbackDate, content: body, updatedAt: get('updatedAt') || new Date().toISOString() }
      if (get('noSync') === 'true') entry.noSync = true
      return entry
    }
  }
  return { date: fallbackDate, content: raw, updatedAt: new Date().toISOString() }
}

// ---------------------------------------------------------------------------
// Kanban — vault/kanban/{id}.json
// ---------------------------------------------------------------------------

const kanbanAdapter: CategoryAdapter = {
  category: 'kanban',
  toSynced(item) {
    const b = item as Board
    return { id: b.id, filename: `${b.id}.json`, updatedAt: b.updatedAt, content: JSON.stringify(b, null, 2), noSync: !!b.noSync }
  },
  async listLocal() {
    const { readAllBoards } = await import('./plainFolder')
    return (await readAllBoards()).map((b) => kanbanAdapter.toSynced(b))
  },
  parse(blob) {
    try {
      const b = JSON.parse(blob.content) as Board
      return { id: b.id, filename: blob.name, updatedAt: b.updatedAt, content: blob.content, noSync: !!b.noSync }
    } catch { return null }
  },
  async writeLocal(blob) {
    const { writePlainBoard } = await import('./plainFolder')
    await writePlainBoard(JSON.parse(blob.content) as Board)
  },
  async reload() {
    const { useKanbanStore } = await import('../store/useKanbanStore')
    await useKanbanStore.getState().loadBoards()
  },
}

// ---------------------------------------------------------------------------
// Canvas — vault/canvas/{id}.json
// ---------------------------------------------------------------------------

const canvasAdapter: CategoryAdapter = {
  category: 'canvas',
  toSynced(item) {
    const c = item as Canvas
    return { id: c.id, filename: `${c.id}.json`, updatedAt: c.updatedAt, content: JSON.stringify(c, null, 2), noSync: !!c.noSync }
  },
  async listLocal() {
    const { readAllCanvases } = await import('./plainFolder')
    return (await readAllCanvases()).map((c) => canvasAdapter.toSynced(c))
  },
  parse(blob) {
    try {
      const c = JSON.parse(blob.content) as Canvas
      return { id: c.id, filename: blob.name, updatedAt: c.updatedAt, content: blob.content, noSync: !!c.noSync }
    } catch { return null }
  },
  async writeLocal(blob) {
    const { writePlainCanvas } = await import('./plainFolder')
    await writePlainCanvas(JSON.parse(blob.content) as Canvas)
  },
  async reload() {
    const { useCanvasStore } = await import('../store/useCanvasStore')
    await useCanvasStore.getState().loadCanvases()
  },
}

export const CONTENT_ADAPTERS: Record<ContentCategory, CategoryAdapter> = {
  journal: journalAdapter,
  kanban: kanbanAdapter,
  canvas: canvasAdapter,
}

export function isContentCategory(category: SyncCategory): category is ContentCategory {
  return category === 'journal' || category === 'kanban' || category === 'canvas'
}
