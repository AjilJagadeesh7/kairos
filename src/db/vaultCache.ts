/**
 * SQLite metadata cache — stores note frontmatter in a vault-local SQLite DB
 * at {vault}/.mindvault/cache.db so startup only needs one SQL query instead
 * of reading every .md file.
 *
 * Desktop-only (tauri-plugin-sql). Web/mobile fall back to the normal FS scan.
 * The cache is always secondary — the .md files are the source of truth.
 */
import { isDesktop } from '../utils/platform'
import type { Note } from '../types'

const DB_FILENAME = 'sqlite:.mindvault-cache.db'

let db: import('@tauri-apps/plugin-sql').default | null = null

async function getDb() {
  if (db) return db
  if (!isDesktop()) return null
  try {
    const Database = (await import('@tauri-apps/plugin-sql')).default
    db = await Database.load(DB_FILENAME)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS note_meta (
        id          TEXT PRIMARY KEY,
        title       TEXT NOT NULL DEFAULT '',
        tags        TEXT NOT NULL DEFAULT '[]',
        folder      TEXT,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        content_hash TEXT NOT NULL DEFAULT ''
      )
    `)
    return db
  } catch (err) {
    console.warn('[vaultCache] SQLite unavailable:', err)
    return null
  }
}

interface MetaRow {
  id: string
  title: string
  tags: string
  folder: string | null
  created_at: string
  updated_at: string
  content_hash: string
}

/** Read all cached note metadata. Returns null if cache is unavailable. */
export async function getCachedNotesMeta(): Promise<Note[] | null> {
  const conn = await getDb()
  if (!conn) return null
  try {
    const rows = await conn.select<MetaRow[]>(
      'SELECT id, title, tags, folder, created_at, updated_at, content_hash FROM note_meta ORDER BY updated_at DESC'
    )
    return rows.map(r => ({
      id:        r.id,
      title:     r.title,
      tags:      JSON.parse(r.tags) as string[],
      folder:    r.folder ?? undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      content:   '',   // not cached — loaded on demand
      embedding: [],
    }))
  } catch {
    return null
  }
}

/** Upsert a single note's metadata after a save. */
export async function upsertCachedMeta(note: Note): Promise<void> {
  const conn = await getDb()
  if (!conn) return
  await conn.execute(
    `INSERT OR REPLACE INTO note_meta (id, title, tags, folder, created_at, updated_at, content_hash)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    [note.id, note.title, JSON.stringify(note.tags), note.folder ?? null, note.createdAt, note.updatedAt, ''],
  ).catch(() => { /* non-fatal */ })
}

/** Delete a note from the cache when it's deleted from the vault. */
export async function deleteCachedMeta(noteId: string): Promise<void> {
  const conn = await getDb()
  if (!conn) return
  await conn.execute('DELETE FROM note_meta WHERE id = ?1', [noteId]).catch(() => {})
}

/** Replace the entire cache after a full sync (file watcher triggered reload). */
export async function rebuildCache(notes: Note[]): Promise<void> {
  const conn = await getDb()
  if (!conn) return
  try {
    await conn.execute('DELETE FROM note_meta')
    // Batch insert in chunks of 100
    for (let i = 0; i < notes.length; i += 100) {
      const chunk = notes.slice(i, i + 100)
      for (const n of chunk) {
        await conn.execute(
          `INSERT OR REPLACE INTO note_meta (id, title, tags, folder, created_at, updated_at, content_hash)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
          [n.id, n.title, JSON.stringify(n.tags), n.folder ?? null, n.createdAt, n.updatedAt, ''],
        )
      }
    }
  } catch (err) {
    console.warn('[vaultCache] rebuild failed:', err)
  }
}
