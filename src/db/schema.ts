import Dexie, { type EntityTable } from 'dexie'
import type { Note, SettingRecord, SyncMeta, TagRecord, JournalEntry, Attachment, TrashItem, AiChatRecord } from '../types'
import type { Board } from '../types/kanban.types'
import type { Canvas } from '../types/canvas.types'
import { defineSchemaVersions } from './schemaVersions'

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
  attachments!: EntityTable<Attachment, 'id'>
  trash!: EntityTable<TrashItem, 'id'>
  aiChats!: EntityTable<AiChatRecord, 'id'>

  constructor() {
    super('kairos')
    defineSchemaVersions(this)
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

export async function getAttachment(id: string): Promise<Attachment | undefined> {
  return db.attachments.get(id)
}

export async function upsertAttachment(record: Attachment): Promise<void> {
  await db.attachments.put(record)
}

export async function deleteAttachment(id: string): Promise<void> {
  await db.attachments.delete(id)
}

export async function getAllAttachments(): Promise<Attachment[]> {
  return db.attachments.orderBy('createdAt').toArray()
}

export async function putTrashItem(item: TrashItem): Promise<void> {
  await db.trash.put(item)
}

/** Newest deletions first. */
export async function getAllTrashItems(): Promise<TrashItem[]> {
  return db.trash.orderBy('deletedAt').reverse().toArray()
}

export async function getTrashItem(id: string): Promise<TrashItem | undefined> {
  return db.trash.get(id)
}

export async function deleteTrashItem(id: string): Promise<void> {
  await db.trash.delete(id)
}

export async function deleteTrashItems(ids: string[]): Promise<void> {
  await db.trash.bulkDelete(ids)
}

export async function clearTrash(): Promise<void> {
  await db.trash.clear()
}
