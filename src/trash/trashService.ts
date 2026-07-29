/**
 * Trash — soft delete with a retention timer.
 *
 * Every content delete routes through `moveToTrash` before the item is removed
 * from its store, the vault and the cloud. The record (including the full
 * serialized original) lives in IndexedDB until it is restored, purged by hand,
 * or swept by the retention timer in `useTrashSweeper`.
 *
 * The trash is deliberately DEVICE-LOCAL: it is never written to the vault or
 * pushed to a sync provider. Mirroring it would let a pull from another device
 * resurrect something you deleted here, and would leave tombstones fighting the
 * last-write-wins content sync.
 */
import { v4 as uuidv4 } from 'uuid'
import {
  putTrashItem,
  getAllTrashItems,
  deleteTrashItems,
  clearTrash as dbClearTrash,
} from '../db/schema'
import type { Note, JournalEntry, Attachment, TrashItem, NewTrashItem } from '../types'
import type { Board } from '../types/kanban.types'
import type { Canvas } from '../types/canvas.types'
import type { PenNote } from '../types/penNote.types'

/** Fired after the trash contents change so open panels can refresh. */
export const TRASH_CHANGED_EVENT = 'mv:trash-changed'

function notifyChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(TRASH_CHANGED_EVENT))
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

export async function moveToTrash(entry: NewTrashItem): Promise<void> {
  const item: TrashItem = { ...entry, id: uuidv4(), deletedAt: new Date().toISOString() }
  await putTrashItem(item)
  notifyChanged()
}

export async function listTrash(): Promise<TrashItem[]> {
  return getAllTrashItems()
}

export async function purgeTrashItems(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  await deleteTrashItems(ids)
  notifyChanged()
}

export async function emptyTrash(): Promise<void> {
  await dbClearTrash()
  notifyChanged()
}

// ---------------------------------------------------------------------------
// Retention timer
// ---------------------------------------------------------------------------

/** When this item auto-purges, or null when retention is set to keep forever. */
export function expiryOf(item: TrashItem, retentionDays: number): Date | null {
  if (retentionDays <= 0) return null
  return new Date(new Date(item.deletedAt).getTime() + retentionDays * 86_400_000)
}

/** Permanently remove every item past its retention window. Returns the count. */
export async function sweepExpiredTrash(retentionDays: number): Promise<number> {
  if (retentionDays <= 0) return 0
  const now = Date.now()
  const expired = (await getAllTrashItems()).filter(item => {
    const at = expiryOf(item, retentionDays)
    return at !== null && at.getTime() <= now
  })
  if (expired.length === 0) return 0
  await purgeTrashItems(expired.map(i => i.id))
  return expired.length
}

// ---------------------------------------------------------------------------
// Per-kind capture — called by each store immediately before it deletes
// ---------------------------------------------------------------------------

export function trashNote(note: Note): Promise<void> {
  // The embedding is derived data rebuilt on demand; keep it out of the payload.
  const { embedding: _embedding, ...rest } = note
  return moveToTrash({
    kind: 'note',
    itemId: note.id,
    title: note.title || 'Untitled note',
    subtitle: note.folder,
    payload: JSON.stringify(rest),
  })
}

export function trashJournalEntry(entry: JournalEntry): Promise<void> {
  return moveToTrash({
    kind: 'journal',
    itemId: entry.date,
    title: entry.date,
    subtitle: 'Journal entry',
    payload: JSON.stringify(entry),
  })
}

export function trashBoard(board: Board): Promise<void> {
  const tasks = board.tasks?.length ?? 0
  return moveToTrash({
    kind: 'kanban',
    itemId: board.id,
    title: board.title || 'Untitled board',
    subtitle: `${tasks} task${tasks === 1 ? '' : 's'}`,
    payload: JSON.stringify(board),
  })
}

export function trashCanvas(canvas: Canvas): Promise<void> {
  const nodes = canvas.nodes?.length ?? 0
  return moveToTrash({
    kind: 'canvas',
    itemId: canvas.id,
    title: canvas.title || 'Untitled canvas',
    subtitle: `${nodes} node${nodes === 1 ? '' : 's'}`,
    payload: JSON.stringify(canvas),
  })
}

export function trashPenNote(penNote: PenNote): Promise<void> {
  return moveToTrash({
    kind: 'pennote',
    itemId: penNote.id,
    title: penNote.title || 'Untitled pen note',
    subtitle: penNote.folder,
    payload: JSON.stringify(penNote),
  })
}

export async function trashAttachment(record: Attachment): Promise<void> {
  const { attachmentMeta } = await import('../attachments/attachmentService')
  await moveToTrash({
    kind: 'attachment',
    itemId: record.id,
    title: record.name,
    subtitle: record.folder,
    payload: JSON.stringify(attachmentMeta(record)),
    // The blob is the primary copy — the vault file is deleted alongside it.
    blob: record.blob,
  })
}
