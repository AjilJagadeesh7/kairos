import type Dexie from 'dexie'
import type { Note } from '../types'

/**
 * Every IndexedDB schema version, oldest first. Dexie needs the full history
 * to upgrade old installs, so versions are only ever appended.
 */
export function defineSchemaVersions(db: Dexie): void {
  db.version(1).stores({
    notes: 'id, title, *tags, createdAt, updatedAt',
    settings: 'key',
    syncMeta: 'noteId, lastSynced, driveFileId',
  })
  // Version 2: separate embeddings table so note list loads don't pull 384-float arrays
  db.version(2)
    .stores({
      notes: 'id, title, *tags, createdAt, updatedAt',
      settings: 'key',
      syncMeta: 'noteId, lastSynced, driveFileId',
      embeddings: 'noteId',
    })
    .upgrade(async (tx) => {
      // Migrate existing embeddings out of the notes table
      const allNotes = (await tx.table('notes').toArray()) as Array<Note & { embedding?: number[] }>
      const records = allNotes
        .filter((n) => n.embedding && n.embedding.length > 0)
        .map((n) => ({ noteId: n.id, data: n.embedding! }))
      if (records.length > 0) await tx.table('embeddings').bulkPut(records)
      // Clear the embedding field from every note record
      await tx.table('notes').toCollection().modify((note: Note & { embedding?: number[] }) => {
        note.embedding = []
      })
    })
  // Version 3: add fileHandles table for File System Access API directory handles
  db.version(3).stores({
    notes: 'id, title, *tags, createdAt, updatedAt',
    settings: 'key',
    syncMeta: 'noteId, lastSynced, driveFileId',
    embeddings: 'noteId',
    fileHandles: 'key',
  })
  // Version 4: add tags table for custom user tags with colors
  db.version(4).stores({
    notes: 'id, title, *tags, createdAt, updatedAt',
    settings: 'key',
    syncMeta: 'noteId, lastSynced, driveFileId',
    embeddings: 'noteId',
    fileHandles: 'key',
    tags: 'name',
  })
  // Version 5: add boards table for kanban
  db.version(5).stores({
    notes: 'id, title, *tags, createdAt, updatedAt',
    settings: 'key',
    syncMeta: 'noteId, lastSynced, driveFileId',
    embeddings: 'noteId',
    fileHandles: 'key',
    tags: 'name',
    boards: 'id, title, updatedAt',
  })
  // Version 6: add dailyNotes table (superseded by v7 rename)
  db.version(6).stores({
    notes: 'id, title, *tags, createdAt, updatedAt',
    settings: 'key',
    syncMeta: 'noteId, lastSynced, driveFileId',
    embeddings: 'noteId',
    fileHandles: 'key',
    tags: 'name',
    boards: 'id, title, updatedAt',
    dailyNotes: 'date, updatedAt',
  })
  // Version 7: rename dailyNotes → journal
  db.version(7).stores({
    notes: 'id, title, *tags, createdAt, updatedAt',
    settings: 'key',
    syncMeta: 'noteId, lastSynced, driveFileId',
    embeddings: 'noteId',
    fileHandles: 'key',
    tags: 'name',
    boards: 'id, title, updatedAt',
    dailyNotes: null,
    journal: 'date, updatedAt',
  })
  // Version 8: drop fileHandles (web File System Access API no longer supported)
  db.version(8).stores({
    notes: 'id, title, *tags, createdAt, updatedAt',
    settings: 'key',
    syncMeta: 'noteId, lastSynced, driveFileId',
    embeddings: 'noteId',
    fileHandles: null,
    tags: 'name',
    boards: 'id, title, updatedAt',
    journal: 'date, updatedAt',
  })
  // Version 9: add canvases table
  db.version(9).stores({
    notes: 'id, title, *tags, createdAt, updatedAt',
    settings: 'key',
    syncMeta: 'noteId, lastSynced, driveFileId',
    embeddings: 'noteId',
    tags: 'name',
    boards: 'id, title, updatedAt',
    journal: 'date, updatedAt',
    canvases: 'id, title, updatedAt',
  })
  // Version 10: add attachments table (file-based media for notes/journal)
  db.version(10).stores({
    notes: 'id, title, *tags, createdAt, updatedAt',
    settings: 'key',
    syncMeta: 'noteId, lastSynced, driveFileId',
    embeddings: 'noteId',
    tags: 'name',
    boards: 'id, title, updatedAt',
    journal: 'date, updatedAt',
    canvases: 'id, title, updatedAt',
    attachments: 'id, [ownerType+ownerId], ownerId, filename',
  })
  // Version 11: attachments become first-class, standalone items (own id, name,
  // folder) instead of being owner-scoped to a note/journal. Clean break — the
  // old owner-scoped rows are cleared (users re-add files under the new model).
  db.version(11)
    .stores({
      notes: 'id, title, *tags, createdAt, updatedAt',
      settings: 'key',
      syncMeta: 'noteId, lastSynced, driveFileId',
      embeddings: 'noteId',
      tags: 'name',
      boards: 'id, title, updatedAt',
      journal: 'date, updatedAt',
      canvases: 'id, title, updatedAt',
      attachments: 'id, name, folder, createdAt',
    })
    .upgrade(async (tx) => {
      await tx.table('attachments').clear()
    })
  // Version 12: add trash table — soft-deleted items awaiting restore or purge.
  // Deliberately device-local (never mirrored to the vault or a sync provider)
  // so a pull from another device can't resurrect something you deleted here.
  db.version(12).stores({
    notes: 'id, title, *tags, createdAt, updatedAt',
    settings: 'key',
    syncMeta: 'noteId, lastSynced, driveFileId',
    embeddings: 'noteId',
    tags: 'name',
    boards: 'id, title, updatedAt',
    journal: 'date, updatedAt',
    canvases: 'id, title, updatedAt',
    attachments: 'id, name, folder, createdAt',
    trash: 'id, kind, deletedAt',
  })
  // Version 13: AI chat history (bubble sessions now, global threads later).
  // Device-local like the trash; stored like notes (not encrypted at rest).
  db.version(13).stores({
    notes: 'id, title, *tags, createdAt, updatedAt',
    settings: 'key',
    syncMeta: 'noteId, lastSynced, driveFileId',
    embeddings: 'noteId',
    tags: 'name',
    boards: 'id, title, updatedAt',
    journal: 'date, updatedAt',
    canvases: 'id, title, updatedAt',
    attachments: 'id, name, folder, createdAt',
    trash: 'id, kind, deletedAt',
    aiChats: 'id, surface, source.id, updatedAt',
  })
  // Version 14: semantic index for the AI global chat — note/journal chunks
  // with their vectors. Device-local, never synced; rebuilt from the vault.
  db.version(14).stores({
    notes: 'id, title, *tags, createdAt, updatedAt',
    settings: 'key',
    syncMeta: 'noteId, lastSynced, driveFileId',
    embeddings: 'noteId',
    tags: 'name',
    boards: 'id, title, updatedAt',
    journal: 'date, updatedAt',
    canvases: 'id, title, updatedAt',
    attachments: 'id, name, folder, createdAt',
    trash: 'id, kind, deletedAt',
    aiChats: 'id, surface, source.id, updatedAt',
    aiChunks: 'id, docId',
  })
}
