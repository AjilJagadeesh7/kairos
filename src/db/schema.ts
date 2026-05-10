import Dexie, { type EntityTable } from 'dexie'
import type { FileHandleRecord, Note, SettingRecord, SyncMeta, TagRecord } from '../types'

type EmbeddingRecord = {
  noteId: string
  data: number[]
  contentHash: string   // sha-256 of the text that was embedded; used to skip re-runs
}

export class MindVaultDB extends Dexie {
  notes!: EntityTable<Note, 'id'>
  settings!: EntityTable<SettingRecord, 'key'>
  syncMeta!: EntityTable<SyncMeta, 'noteId'>
  embeddings!: EntityTable<EmbeddingRecord, 'noteId'>
  fileHandles!: EntityTable<FileHandleRecord, 'key'>
  tags!: EntityTable<TagRecord, 'name'>

  constructor() {
    super('mindvault')
    this.version(1).stores({
      notes: 'id, title, *tags, createdAt, updatedAt',
      settings: 'key',
      syncMeta: 'noteId, lastSynced, driveFileId',
    })
    // Version 2: separate embeddings table so note list loads don't pull 384-float arrays
    this.version(2)
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
    this.version(3).stores({
      notes: 'id, title, *tags, createdAt, updatedAt',
      settings: 'key',
      syncMeta: 'noteId, lastSynced, driveFileId',
      embeddings: 'noteId',
      fileHandles: 'key',
    })
    // Version 4: add tags table for custom user tags with colors
    this.version(4).stores({
      notes: 'id, title, *tags, createdAt, updatedAt',
      settings: 'key',
      syncMeta: 'noteId, lastSynced, driveFileId',
      embeddings: 'noteId',
      fileHandles: 'key',
      tags: 'name',
    })
  }
}

export const db = new MindVaultDB()

export async function upsertNote(note: Note): Promise<void> {
  await db.notes.put(note)
}

export async function upsertEmbedding(noteId: string, data: number[], contentHash: string): Promise<void> {
  if (data.length > 0) await db.embeddings.put({ noteId, data, contentHash })
}

export async function getEmbedding(noteId: string): Promise<number[]> {
  const record = await db.embeddings.get(noteId)
  return record?.data ?? []
}

export async function getEmbeddingRecord(noteId: string): Promise<EmbeddingRecord | undefined> {
  return db.embeddings.get(noteId)
}

export async function deleteNote(id: string): Promise<void> {
  await db.notes.delete(id)
  await db.syncMeta.delete(id)
  await db.embeddings.delete(id)
}

export async function getSetting(key: string): Promise<string | undefined> {
  const row = await db.settings.get(key)
  return row?.value
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.settings.put({ key, value })
}

export async function getAllTags(): Promise<TagRecord[]> {
  return db.tags.toArray()
}

export async function getTag(name: string): Promise<TagRecord | undefined> {
  return db.tags.get(name)
}

export async function upsertTag(tag: TagRecord): Promise<void> {
  await db.tags.put(tag)
}

export async function deleteTag(name: string): Promise<void> {
  await db.tags.delete(name)
}
