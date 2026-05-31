import { vi, describe, it, expect, beforeEach } from 'vitest'
import { syncAllProviders, pushNoteToAll } from './syncOrchestrator'
import { useConflictStore } from '../store/useConflictStore'
import { serializeNote } from '../adapters/storage/noteSerializer'
import { db } from '../db/schema'
import type { Note } from '../types'
import type { RemoteProvider } from './remoteProvider'

// A single fake remote provider whose blob ops we can assert against.
const provider = {
  id: 's3' as const,
  isConnected: vi.fn().mockReturnValue(true),
  putBlob: vi.fn().mockResolvedValue(undefined),
  listBlob: vi.fn().mockResolvedValue([]),
  deleteBlob: vi.fn().mockResolvedValue(undefined),
} satisfies RemoteProvider

vi.mock('./remoteProvider', () => ({
  connectedProviders: () => [provider],
  anyRemoteConnected: () => true,
}))

// Sync everything by default; individual tests can override.
vi.mock('./syncRules', () => ({
  canPush: vi.fn().mockReturnValue(true),
  canPull: vi.fn().mockReturnValue(true),
}))

// No content categories / config exercised in these note-focused tests.
vi.mock('./categoryRegistry', () => ({ CONTENT_ADAPTERS: {} }))
vi.mock('./settingsSync', () => ({ syncConfigWithCloud: vi.fn().mockResolvedValue(undefined) }))

vi.mock('./plainFolder', () => ({
  isPlainFolderConnected: vi.fn().mockReturnValue(true),
  readAllNotes: vi.fn().mockResolvedValue([]),
  writePlainNote: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../db/schema', () => ({
  db: { syncMeta: { put: vi.fn().mockResolvedValue(undefined), get: vi.fn().mockResolvedValue(undefined), delete: vi.fn().mockResolvedValue(undefined) } },
}))

import { isPlainFolderConnected, readAllNotes, writePlainNote } from './plainFolder'

const note = (over: Partial<Note> = {}): Note =>
  ({ id: 'n', title: 'T', content: 'C', tags: [], createdAt: '', updatedAt: '', embedding: [], ...over })

describe('syncOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    provider.isConnected.mockReturnValue(true)
    provider.putBlob.mockResolvedValue(undefined)
    provider.listBlob.mockResolvedValue([])
    provider.deleteBlob.mockResolvedValue(undefined)
    vi.mocked(isPlainFolderConnected).mockReturnValue(true)
    vi.mocked(readAllNotes).mockResolvedValue([])
    useConflictStore.setState({ conflicts: [] })
  })

  describe('pushNoteToAll', () => {
    it('pushes the note to every connected provider and records lastSynced', async () => {
      await pushNoteToAll(note({ id: 'note-1' }))
      expect(provider.putBlob).toHaveBeenCalledWith('notes', 'note-1.md', expect.any(String))
      expect(db.syncMeta.put).toHaveBeenCalledWith(expect.objectContaining({ noteId: 'note-1' }))
    })

    it('deletes the cloud copy (no push) when the note is opted out', async () => {
      await pushNoteToAll(note({ id: 'note-x', noSync: true }))
      expect(provider.deleteBlob).toHaveBeenCalledWith('notes', 'note-x.md')
      expect(provider.putBlob).not.toHaveBeenCalled()
    })
  })

  describe('syncAllProviders', () => {
    it('detects a conflict when both local and remote changed since last sync', async () => {
      const local  = note({ id: 'c', content: 'Local content',  updatedAt: '2026-05-20T10:00:00Z' })
      const remote = note({ id: 'c', content: 'Remote content', updatedAt: '2026-05-20T11:00:00Z' })
      vi.mocked(readAllNotes).mockResolvedValue([local])
      provider.listBlob.mockImplementation((cat: string) =>
        Promise.resolve(cat === 'notes' ? [{ name: 'c.md', content: serializeNote(remote) }] : []))
      vi.mocked(db.syncMeta.get).mockResolvedValue({ noteId: 'c', lastSynced: '2026-05-20T09:00:00Z' })

      const onStatus = vi.fn()
      await syncAllProviders(onStatus)

      expect(useConflictStore.getState().conflicts).toHaveLength(1)
      expect(useConflictStore.getState().conflicts[0].noteId).toBe('c')
      expect(writePlainNote).not.toHaveBeenCalled()
      expect(onStatus).toHaveBeenLastCalledWith('ok')
    })

    it('downloads a newer remote note when local was unchanged since last sync', async () => {
      const local  = note({ id: 's', content: 'Local content',  updatedAt: '2026-05-20T08:00:00Z' })
      const remote = note({ id: 's', content: 'Remote content', updatedAt: '2026-05-20T11:00:00Z' })
      vi.mocked(readAllNotes).mockResolvedValue([local])
      provider.listBlob.mockImplementation((cat: string) =>
        Promise.resolve(cat === 'notes' ? [{ name: 's.md', content: serializeNote(remote) }] : []))
      vi.mocked(db.syncMeta.get).mockResolvedValue({ noteId: 's', lastSynced: '2026-05-20T09:00:00Z' })

      const onStatus = vi.fn()
      await syncAllProviders(onStatus)

      expect(writePlainNote).toHaveBeenCalledWith(expect.objectContaining({ id: 's', content: 'Remote content' }))
      expect(onStatus).toHaveBeenLastCalledWith('ok')
    })
  })
})
