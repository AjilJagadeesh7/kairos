import { v4 as uuidv4 } from 'uuid'
import { upsertEmbedding } from '../../db/schema'
import { useLoaderStore } from '../useLoaderStore'
import { parseTags, rewriteWikilinksInContent } from '../../utils/wikilinks'
import { buildIndex, indexNote, deindexNote } from '../../search/noteIndex'
import type { AppGet, AppSet, AppState, Note } from '../../types'

type NoteActions = Pick<AppState,
  | 'loadNotes' | 'createNote' | 'updateNote' | 'updateActiveNote' | 'updateNoteTags'
  | 'setNoteNoSync' | 'updateNoteFrontmatter' | 'appendWikilink' | 'deleteNoteById'
  | 'moveNoteToFolder'>

/** Persist a note to the vault, best-effort — the in-memory store is the source of truth. */
async function writeNote(note: Note): Promise<void> {
  const { writePlainNote, isPlainFolderConnected } = await import('../../sync/plainFolder')
  if (isPlainFolderConnected()) {
    writePlainNote(note).catch(err => console.warn('[storage] write failed:', err))
  }
}

/** Note CRUD for `useAppStore`. */
export function noteActions(set: AppSet, get: AppGet): NoteActions {
  /** Replace one note everywhere: search index, memory, vault. */
  const commit = async (updated: Note): Promise<void> => {
    indexNote(updated)
    set(s => ({ notes: s.notes.map(n => n.id === updated.id ? updated : n) }))
    await writeNote(updated)
  }

  return {
    loadNotes: async () => {
      const { readAllNotes, isPlainFolderConnected } = await import('../../sync/plainFolder')
      if (!isPlainFolderConnected()) {
        set({ isNotesLoaded: true })
        return
      }
      await useLoaderStore.getState().run('load-notes', async () => {
        try {
          const notes = await readAllNotes()
          notes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          buildIndex(notes)
          set({ notes, isNotesLoaded: true })
        } catch (err) {
          console.warn('[loadNotes] failed:', err)
          set({ isNotesLoaded: true })
        }
      })
    },

    createNote: async (initial) => {
      const { run } = useLoaderStore.getState()
      return run('create-note', async () => {
        const now = new Date().toISOString()
        const id = uuidv4()
        const note: Note = {
          id,
          title: initial?.title ?? 'Untitled note',
          content: initial?.content ?? '',
          tags: [],
          embedding: [],
          createdAt: now,
          updatedAt: now,
          folder: initial?.folder || undefined,
        }

        // Write to filesystem (primary storage)
        const { writePlainNote, isPlainFolderConnected } = await import('../../sync/plainFolder')
        if (isPlainFolderConnected()) {
          await writePlainNote(note)
        }

        // Add to in-memory store and search index
        indexNote(note)
        set(s => ({ notes: [note, ...s.notes], activeNoteId: id }))
        return id
      }, 'Creating note…')
    },

    updateNote: async (noteId, patch) => {
      // Temporarily set activeNoteId to the target note so updateActiveNote targets the right note
      set({ activeNoteId: noteId })
      await get().updateActiveNote(patch)
    },

    updateActiveNote: async ({ title, content, embedding, contentHash }) => {
      const { activeNoteId, notes } = get()
      if (!activeNoteId) return
      const existing = notes.find(n => n.id === activeNoteId)
      if (!existing) return

      const updated: Note = {
        ...existing,
        title,
        content,
        embedding: [],
        tags: parseTags(content),
        updatedAt: new Date().toISOString(),
      }

      // Update search index and in-memory store — in-place map keeps array
      // positions stable so sidebar items don't shift on every keystroke
      indexNote(updated)
      set(s => ({
        notes: s.notes.map(n => n.id === activeNoteId ? updated : n),
      }))

      // Auto-update wikilinks in all other notes when title changes
      const oldTitle = existing.title
      if (oldTitle && oldTitle !== title) {
        await rewriteBacklinks(set, get, activeNoteId, oldTitle, title)
      }

      // Write to filesystem (primary storage) and append a version snapshot
      const { writePlainNote, appendNoteVersion, isPlainFolderConnected } = await import('../../sync/plainFolder')
      if (isPlainFolderConnected()) {
        writePlainNote(updated).catch(err => console.warn('[storage] write failed:', err))
        appendNoteVersion(updated.id, { savedAt: updated.updatedAt, title: updated.title, content: updated.content })
          .catch(err => console.warn('[history] append failed:', err))
      }

      // Store embedding in Dexie (for semantic search)
      if (embedding && embedding.length > 0) {
        await upsertEmbedding(activeNoteId, embedding, contentHash)
      }

      // Background push to all connected sync providers
      const { setSyncStatus } = get()
      const { pushNoteToAll, anySyncProviderConnected } = await import('../../sync/syncOrchestrator')
      if (anySyncProviderConnected()) {
        setSyncStatus('syncing')
        pushNoteToAll(updated)
          .then(() => setSyncStatus('ok'))
          .catch(err => {
            console.warn('[sync] push failed — queued for retry:', err)
            setSyncStatus('error')
            void import('../../sync/offlineQueue').then(({ enqueue }) => enqueue(updated.id))
          })
      }
    },

    updateNoteTags: async (noteId, tags) => {
      const existing = get().notes.find(n => n.id === noteId)
      if (!existing) return
      await commit({ ...existing, tags, updatedAt: new Date().toISOString() })
    },

    setNoteNoSync: async (noteId, value) => {
      const existing = get().notes.find(n => n.id === noteId)
      if (!existing) return
      const updated: Note = { ...existing, noSync: value || undefined, updatedAt: new Date().toISOString() }
      set(s => ({ notes: s.notes.map(n => n.id === noteId ? updated : n) }))
      await writeNote(updated)
      // pushNoteToAll deletes the cloud copy when noSync, or re-pushes when re-enabled.
      const { pushNoteToAll, anySyncProviderConnected } = await import('../../sync/syncOrchestrator')
      if (anySyncProviderConnected()) void pushNoteToAll(updated)
    },

    updateNoteFrontmatter: async (noteId, fm) => {
      const existing = get().notes.find(n => n.id === noteId)
      if (!existing) return
      const updated: Note = { ...existing, userFrontmatter: fm, updatedAt: new Date().toISOString() }
      set(s => ({ notes: s.notes.map(n => n.id === noteId ? updated : n) }))
      await writeNote(updated)
    },

    appendWikilink: async (noteId, targetTitle) => {
      const existing = get().notes.find(n => n.id === noteId)
      if (!existing) return
      const separator = existing.content.trimEnd().length > 0 ? '\n\n' : ''
      const updated: Note = {
        ...existing,
        content: `${existing.content.trimEnd()}${separator}[[${targetTitle}]]`,
        updatedAt: new Date().toISOString(),
      }
      set(s => ({ notes: s.notes.map(n => n.id === noteId ? updated : n) }))
      await writeNote(updated)
    },

    deleteNoteById: async (id) => {
      const { run } = useLoaderStore.getState()
      await run('delete-note', async () => {
        // Capture a restorable copy before anything is removed.
        const doomed = get().notes.find(n => n.id === id)
        if (doomed) {
          const { trashNote } = await import('../../trash/trashService')
          await trashNote(doomed).catch(err => console.warn('[trash] capture failed:', err))
        }

        deindexNote(id)
        // Remove from in-memory store
        set(s => ({
          notes: s.notes.filter(n => n.id !== id),
          activeNoteId: s.activeNoteId === id ? undefined : s.activeNoteId,
        }))

        // Delete from filesystem (note + history)
        const { deletePlainNote, deleteNoteHistory, isPlainFolderConnected } = await import('../../sync/plainFolder')
        if (isPlainFolderConnected()) {
          await deletePlainNote(id).catch(() => { /* best-effort */ })
          deleteNoteHistory(id).catch(() => { /* best-effort */ })
        }

        // Remove from sync providers
        const { deleteNoteFromAll, anySyncProviderConnected } = await import('../../sync/syncOrchestrator')
        if (anySyncProviderConnected()) await deleteNoteFromAll(id)
      }, 'Deleting note…')
    },

    moveNoteToFolder: async (noteId, folder) => {
      const existing = get().notes.find(n => n.id === noteId)
      if (!existing) return
      await commit({ ...existing, folder: folder || undefined, updatedAt: new Date().toISOString() })
    },
  }
}

/** Retitle every `[[wikilink]]` pointing at a renamed note, then persist and report. */
async function rewriteBacklinks(
  set: AppSet, get: AppGet, skipNoteId: string, oldTitle: string, newTitle: string,
): Promise<void> {
  const { writePlainNote, isPlainFolderConnected } = await import('../../sync/plainFolder')
  const connected = isPlainFolderConnected()
  const rewritten: Note[] = []

  for (const note of get().notes) {
    if (note.id === skipNoteId) continue
    const newContent = rewriteWikilinksInContent(note.content, oldTitle, newTitle)
    if (newContent === note.content) continue
    const rewrote: Note = { ...note, content: newContent, updatedAt: new Date().toISOString() }
    indexNote(rewrote)
    rewritten.push(rewrote)
  }
  if (rewritten.length === 0) return

  const rewrittenIds = new Set(rewritten.map(n => n.id))
  set(s => ({
    notes: s.notes.map(n => rewrittenIds.has(n.id) ? rewritten.find(r => r.id === n.id)! : n),
  }))
  if (connected) {
    // Fire-and-forget — don't block the save
    void Promise.all(rewritten.map(n => writePlainNote(n).catch(() => {})))
  }
  const { toast } = await import('sonner')
  toast.success(`Updated ${rewritten.length} note${rewritten.length > 1 ? 's' : ''} with new title`)
}
