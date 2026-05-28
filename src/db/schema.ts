import Dexie, { type EntityTable } from 'dexie'
import type { Note, SettingRecord, SyncMeta, TagRecord, JournalEntry } from '../types'
import type { Board } from '../types/kanban.types'
import type { Canvas } from '../types/canvas.types'

type EmbeddingRecord = {
  noteId: string
  data: number[]
  contentHash: string   // sha-256 of the text that was embedded; used to skip re-runs
}

export class KairosDB extends Dexie {
  notes!: EntityTable<Note, 'id'>
  settings!: EntityTable<SettingRecord, 'key'>
  syncMeta!: EntityTable<SyncMeta, 'noteId'>
  embeddings!: EntityTable<EmbeddingRecord, 'noteId'>
  tags!: EntityTable<TagRecord, 'name'>
  boards!: EntityTable<Board, 'id'>
  journal!: EntityTable<JournalEntry, 'date'>
  canvases!: EntityTable<Canvas, 'id'>

  constructor() {
    super('kairos')
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
    // Version 5: add boards table for kanban
    this.version(5).stores({
      notes: 'id, title, *tags, createdAt, updatedAt',
      settings: 'key',
      syncMeta: 'noteId, lastSynced, driveFileId',
      embeddings: 'noteId',
      fileHandles: 'key',
      tags: 'name',
      boards: 'id, title, updatedAt',
    })
    // Version 6: add dailyNotes table (superseded by v7 rename)
    this.version(6).stores({
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
    this.version(7).stores({
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
    this.version(8).stores({
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
    this.version(9).stores({
      notes: 'id, title, *tags, createdAt, updatedAt',
      settings: 'key',
      syncMeta: 'noteId, lastSynced, driveFileId',
      embeddings: 'noteId',
      tags: 'name',
      boards: 'id, title, updatedAt',
      journal: 'date, updatedAt',
      canvases: 'id, title, updatedAt',
    })
  }
}

export const db = new KairosDB()

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

export async function getAllBoards(): Promise<Board[]> {
  return db.boards.orderBy('updatedAt').reverse().toArray()
}

export async function upsertBoard(board: Board): Promise<void> {
  await db.boards.put(board)
}

export async function deleteBoardFromDB(id: string): Promise<void> {
  await db.boards.delete(id)
}

export async function getAllJournalEntries(): Promise<JournalEntry[]> {
  return db.journal.orderBy('date').reverse().toArray()
}

export async function upsertJournalEntry(entry: JournalEntry): Promise<void> {
  await db.journal.put(entry)
}

export async function deleteJournalEntryFromDB(date: string): Promise<void> {
  await db.journal.delete(date)
}

export async function getAllCanvases(): Promise<Canvas[]> {
  return db.canvases.orderBy('updatedAt').reverse().toArray()
}

export async function upsertCanvas(canvas: Canvas): Promise<void> {
  await db.canvases.put(canvas)
}

export async function deleteCanvasFromDB(id: string): Promise<void> {
  await db.canvases.delete(id)
}
