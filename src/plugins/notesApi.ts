import { useAppStore } from '../store/useAppStore'
import { indexNote } from '../search/noteIndex'
import { gate } from './permissionGate'
import type { PluginManifest, KairosPluginAPI, NoteListItem, NoteView, NoteWriteData } from './types'

export function buildNotesApi(manifest: PluginManifest): KairosPluginAPI['notes'] {
  return {
    list(): NoteListItem[] {
      gate(manifest, 'read:notes', 'notes.list')
      return useAppStore.getState().notes.map(({ id, title, tags, updatedAt, createdAt }) => ({
        id, title, tags, updatedAt, createdAt,
      }))
    },

    get(noteId: string): NoteView | null {
      gate(manifest, 'read:notes', 'notes.get')
      const note = useAppStore.getState().notes.find(n => n.id === noteId) ?? null
      if (!note) return null
      const { id, title, content, tags, updatedAt, createdAt } = note
      return { id, title, content, tags, updatedAt, createdAt }
    },

    async create(data: { title: string; content?: string }): Promise<string> {
      gate(manifest, 'write:notes', 'notes.create')
      return useAppStore.getState().createNote({ title: data.title, content: data.content })
    },

    async update(noteId: string, patch: NoteWriteData): Promise<void> {
      gate(manifest, 'write:notes', 'notes.update')
      const { notes } = useAppStore.getState()
      const note = notes.find(n => n.id === noteId)
      if (!note) throw new Error(`Plugin "${manifest.id}": note "${noteId}" not found`)

      const updated = {
        ...note,
        title:     patch.title   ?? note.title,
        content:   patch.content ?? note.content,
        tags:      patch.tags    ?? note.tags,
        updatedAt: new Date().toISOString(),
      }

      indexNote(updated)
      useAppStore.setState(s => ({ notes: s.notes.map(n => n.id === noteId ? updated : n) }))

      const { writePlainNote, appendNoteVersion, isPlainFolderConnected } = await import('../sync/plainFolder')
      if (isPlainFolderConnected()) {
        await writePlainNote(updated)
        appendNoteVersion(noteId, { savedAt: updated.updatedAt, title: updated.title, content: updated.content })
          .catch(() => { /* best-effort */ })
      }

      const { pushNoteToAll, anySyncProviderConnected } = await import('../sync/syncOrchestrator')
      if (anySyncProviderConnected()) {
        useAppStore.getState().setSyncStatus('syncing')
        pushNoteToAll(updated)
          .then(() => useAppStore.getState().setSyncStatus('ok'))
          .catch(() => {
            useAppStore.getState().setSyncStatus('error')
            void import('../sync/offlineQueue').then(({ enqueue }) => enqueue(noteId))
          })
      }
    },

    async delete(noteId: string): Promise<void> {
      gate(manifest, 'write:notes', 'notes.delete')
      await useAppStore.getState().deleteNoteById(noteId)
    },
  }
}
