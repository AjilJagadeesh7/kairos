import { vi, describe, it, expect, beforeEach } from 'vitest'
import { syncAllProviders, pushNoteToAll } from './syncOrchestrator'
import { useConflictStore } from '../store/useConflictStore'
import { db } from '../db/schema'
import type { Note } from '../types'

// Mock storage and sync modules
vi.mock('./localFolder', () => ({
  isLocalFolderConnected: vi.fn(),
  listLocalNotes: vi.fn(),
  upsertLocalNote: vi.fn(),
  deleteLocalNote: vi.fn(),
}))

vi.mock('./s3', () => ({
  isS3Connected: vi.fn(),
  listS3Notes: vi.fn(),
  upsertS3Note: vi.fn(),
  deleteS3Note: vi.fn(),
}))

vi.mock('./webdav', () => ({
  isWebDAVConnected: vi.fn(),
  listWebDAVNotes: vi.fn(),
  upsertWebDAVNote: vi.fn(),
  deleteWebDAVNote: vi.fn(),
}))

vi.mock('./plainFolder', () => ({
  isPlainFolderConnected: vi.fn(),
  readAllNotes: vi.fn(),
  writePlainNote: vi.fn(),
  deletePlainNote: vi.fn(),
}))

// Mock Dexie db schema
vi.mock('../db/schema', () => ({
  db: {
    syncMeta: {
      put: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

import { isLocalFolderConnected, upsertLocalNote } from './localFolder'
import { isS3Connected, listS3Notes, upsertS3Note } from './s3'
import { isWebDAVConnected } from './webdav'

describe('syncOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useConflictStore.setState({ conflicts: [] })
  })

  describe('pushNoteToAll', () => {
    it('pushes to all connected providers and updates lastSynced in Dexie', async () => {
      vi.mocked(isLocalFolderConnected).mockReturnValue(true)
      vi.mocked(isS3Connected).mockReturnValue(true)
      vi.mocked(isWebDAVConnected).mockReturnValue(false)

      vi.mocked(upsertLocalNote).mockResolvedValue('path-local')
      vi.mocked(upsertS3Note).mockResolvedValue('path-s3')

      const note: Note = { id: 'note-1', title: 'Test', content: 'Hello', tags: [], createdAt: '', updatedAt: '', embedding: [] }
      await pushNoteToAll(note)

      expect(upsertLocalNote).toHaveBeenCalledWith(note)
      expect(upsertS3Note).toHaveBeenCalledWith(note)
      expect(db.syncMeta.put).toHaveBeenCalledWith(expect.objectContaining({
        noteId: 'note-1',
        lastSynced: expect.any(String),
      }))
    })
  })

  describe('syncAllProviders', () => {
    it('detects a conflict when both local and remote changed since last sync', async () => {
      // Connect S3
      vi.mocked(isS3Connected).mockReturnValue(true)
      vi.mocked(isLocalFolderConnected).mockReturnValue(false)
      vi.mocked(isWebDAVConnected).mockReturnValue(false)

      // Connect plain local folder
      const plainFolder = await import('./plainFolder')
      vi.mocked(plainFolder.isPlainFolderConnected).mockReturnValue(true)

      const localNote: Note = { id: 'note-conflict', title: 'Local title', content: 'Local content', tags: [], createdAt: '', updatedAt: '2026-05-20T10:00:00Z', embedding: [] }
      const remoteNote: Note = { id: 'note-conflict', title: 'Remote title', content: 'Remote content', tags: [], createdAt: '', updatedAt: '2026-05-20T11:00:00Z', embedding: [] }

      vi.mocked(plainFolder.readAllNotes).mockResolvedValue([localNote])
      vi.mocked(listS3Notes).mockResolvedValue([remoteNote])

      // Last sync was at 2026-05-20T09:00:00Z
      vi.mocked(db.syncMeta.get).mockResolvedValue({ noteId: 'note-conflict', lastSynced: '2026-05-20T09:00:00Z', driveFileId: '' })

      const statusCallback = vi.fn()
      await syncAllProviders(statusCallback)

      expect(statusCallback).toHaveBeenCalledWith('syncing')
      expect(useConflictStore.getState().conflicts).toHaveLength(1)
      expect(useConflictStore.getState().conflicts[0].noteId).toBe('note-conflict')
      expect(plainFolder.writePlainNote).not.toHaveBeenCalled()
      expect(statusCallback).toHaveBeenLastCalledWith('ok')
    })

    it('downloads newer remote notes without conflict if local was not changed since last sync', async () => {
      vi.mocked(isS3Connected).mockReturnValue(true)
      vi.mocked(isLocalFolderConnected).mockReturnValue(false)
      vi.mocked(isWebDAVConnected).mockReturnValue(false)

      const plainFolder = await import('./plainFolder')
      vi.mocked(plainFolder.isPlainFolderConnected).mockReturnValue(true)

      // Local has older timestamp, but has NOT changed since last sync (which was at 2026-05-20T09:00:00Z)
      const localNote: Note = { id: 'note-sync', title: 'Local', content: 'Local content', tags: [], createdAt: '', updatedAt: '2026-05-20T08:00:00Z', embedding: [] }
      const remoteNote: Note = { id: 'note-sync', title: 'Remote', content: 'Remote content', tags: [], createdAt: '', updatedAt: '2026-05-20T11:00:00Z', embedding: [] }

      vi.mocked(plainFolder.readAllNotes).mockResolvedValue([localNote])
      vi.mocked(listS3Notes).mockResolvedValue([remoteNote])

      // Last sync was after local was modified, so local is unchanged since sync
      vi.mocked(db.syncMeta.get).mockResolvedValue({ noteId: 'note-sync', lastSynced: '2026-05-20T09:00:00Z', driveFileId: '' })

      const statusCallback = vi.fn()
      await syncAllProviders(statusCallback)

      expect(plainFolder.writePlainNote).toHaveBeenCalledWith(expect.objectContaining({
        id: 'note-sync',
        content: 'Remote content',
      }))
      expect(statusCallback).toHaveBeenLastCalledWith('ok')
    })
  })
})
