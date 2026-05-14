import type { StorageAdapter } from './StorageAdapter'
import { serializeNote, deserializeNote, noteIdToPath, pathToNoteId } from './noteSerializer'
import { db, upsertNote, deleteNote as dbDeleteNote } from '../../db/schema'

/**
 * StorageAdapter backed by the existing Dexie/IndexedDB notes table.
 * Notes are serialized to/from markdown+frontmatter strings.
 * This is the default fallback adapter on all platforms.
 */
export class IndexDBAdapter implements StorageAdapter {
  async read(path: string): Promise<string> {
    const id = pathToNoteId(path)
    const note = await db.notes.get(id)
    if (!note) throw new Error(`Note not found: ${path}`)
    return serializeNote(note)
  }

  async write(path: string, content: string): Promise<void> {
    const note = deserializeNote(content)
    // Ensure the id in frontmatter matches the requested path
    const id = pathToNoteId(path)
    await upsertNote({ ...note, id })
  }

  async delete(path: string): Promise<void> {
    const id = pathToNoteId(path)
    await dbDeleteNote(id)
  }

  async list(_dir: string): Promise<string[]> {
    const notes = await db.notes.toArray()
    return notes.map((n) => noteIdToPath(n.id))
  }

  async exists(path: string): Promise<boolean> {
    const id = pathToNoteId(path)
    const note = await db.notes.get(id)
    return note !== undefined
  }
}
