/**
 * Restoring a trashed item — rebuilds it in its store, the vault, and the cloud.
 *
 * Each branch mirrors the "create/save" path of the owning store rather than
 * calling that store's create action, so the original id, timestamps and folder
 * are preserved exactly as they were at delete time.
 */
import type { Note, JournalEntry, AttachmentMeta, TrashItem } from '../types'
import type { Board } from '../types/kanban.types'
import type { Canvas } from '../types/canvas.types'
import type { PenNote } from '../types/penNote.types'

async function restoreNote(payload: string): Promise<void> {
  const note = { ...(JSON.parse(payload) as Omit<Note, 'embedding'>), embedding: [] } as Note

  // Mirrors createNote: the vault is primary storage, the store and index follow.
  const { writePlainNote, isPlainFolderConnected } = await import('../sync/plainFolder')
  if (isPlainFolderConnected()) await writePlainNote(note).catch(() => {})

  const { useAppStore } = await import('../store/useAppStore')
  useAppStore.setState(s => ({ notes: [note, ...s.notes.filter(n => n.id !== note.id)] }))

  const { indexNote } = await import('../search/noteIndex')
  indexNote(note)

  const { pushNoteToAll, anySyncProviderConnected } = await import('../sync/syncOrchestrator')
  if (anySyncProviderConnected()) void pushNoteToAll(note)
}

async function restoreJournalEntry(payload: string): Promise<void> {
  const entry = JSON.parse(payload) as JournalEntry

  const { writeJournalEntry, isPlainFolderConnected } = await import('../sync/plainFolder')
  if (isPlainFolderConnected()) await writeJournalEntry(entry).catch(() => {})

  const { useJournalStore } = await import('../store/useJournalStore')
  useJournalStore.setState(s => ({ entries: { ...s.entries, [entry.date]: entry } }))

  const { schedulePush } = await import('../sync/debouncedCloudPush')
  schedulePush('journal', entry.date, entry)
}

async function restoreBoard(payload: string): Promise<void> {
  const board = JSON.parse(payload) as Board

  const { useKanbanStore } = await import('../store/useKanbanStore')
  useKanbanStore.setState(s => ({ boards: [board, ...s.boards.filter(b => b.id !== board.id)] }))

  const { fsUpsertBoard } = await import('../store/kanban/helpers')
  await fsUpsertBoard(board)
}

async function restoreCanvas(payload: string): Promise<void> {
  const canvas = JSON.parse(payload) as Canvas

  const { useCanvasStore } = await import('../store/useCanvasStore')
  useCanvasStore.setState(s => ({ canvases: [canvas, ...s.canvases.filter(c => c.id !== canvas.id)] }))

  const { writePlainCanvas, isPlainFolderConnected } = await import('../sync/plainFolder')
  if (isPlainFolderConnected()) await writePlainCanvas(canvas).catch(() => {})

  const { schedulePush } = await import('../sync/debouncedCloudPush')
  schedulePush('canvas', canvas.id, canvas)
}

async function restorePenNote(payload: string): Promise<void> {
  const penNote = JSON.parse(payload) as PenNote

  const { usePenNoteStore } = await import('../store/usePenNoteStore')
  usePenNoteStore.setState(s => ({ penNotes: [penNote, ...s.penNotes.filter(p => p.id !== penNote.id)] }))

  const { writePlainPenNote, isPlainFolderConnected } = await import('../sync/plainFolder')
  if (isPlainFolderConnected()) await writePlainPenNote(penNote).catch(() => {})

  const { schedulePush } = await import('../sync/debouncedCloudPush')
  schedulePush('pennote', penNote.id, penNote)
}

async function restoreAttachment(payload: string, blob: Blob | undefined): Promise<void> {
  if (!blob) throw new Error('attachment blob missing from the trash record')
  const meta = JSON.parse(payload) as AttachmentMeta
  const bytes = new Uint8Array(await blob.arrayBuffer())

  const { reinstateAttachment } = await import('../attachments/attachmentService')
  await reinstateAttachment(meta, bytes)

  const { useAttachmentStore } = await import('../store/useAttachmentStore')
  await useAttachmentStore.getState().loadAttachments()
}

/**
 * Put a trashed item back where it came from. Throws if the payload can't be
 * parsed or written — the caller keeps the trash record in that case.
 */
export async function restoreTrashItem(item: TrashItem): Promise<void> {
  switch (item.kind) {
    case 'note':       return restoreNote(item.payload)
    case 'journal':    return restoreJournalEntry(item.payload)
    case 'kanban':     return restoreBoard(item.payload)
    case 'canvas':     return restoreCanvas(item.payload)
    case 'pennote':    return restorePenNote(item.payload)
    case 'attachment': return restoreAttachment(item.payload, item.blob)
  }
}
