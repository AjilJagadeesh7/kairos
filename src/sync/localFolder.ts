import { db } from '../db/schema'
import type { RemoteEncryptedNote } from './types'

const HANDLE_KEY = 'localFolderHandle'
const FILE_PREFIX = 'mindvault-note-'

let _handle: FileSystemDirectoryHandle | null = null

/** Call once on app start to restore the handle if permission is still valid. */
export async function initLocalFolder(): Promise<void> {
  try {
    const rec = await db.fileHandles.get(HANDLE_KEY)
    if (!rec?.handle) return
    const h = rec.handle as FileSystemDirectoryHandle
    const perm = await h.queryPermission({ mode: 'readwrite' })
    if (perm === 'granted') _handle = h
  } catch {
    _handle = null
  }
}

export function isLocalFolderConnected(): boolean {
  return _handle !== null
}

export function getLocalFolderName(): string | null {
  return _handle?.name ?? null
}

/**
 * Shows the directory picker (or re-requests permission on a stored handle).
 * Must be called from a user gesture.
 */
export async function connectLocalFolder(): Promise<void> {
  // Try to re-request permission on the previously stored handle first.
  try {
    const rec = await db.fileHandles.get(HANDLE_KEY)
    if (rec?.handle) {
      const h = rec.handle as FileSystemDirectoryHandle
      const perm = await h.requestPermission({ mode: 'readwrite' })
      if (perm === 'granted') {
        _handle = h
        return
      }
    }
  } catch {
    // Fall through to directory picker.
  }

  const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
  _handle = handle
  await db.fileHandles.put({ key: HANDLE_KEY, handle: handle as unknown })
}

export async function disconnectLocalFolder(): Promise<void> {
  _handle = null
  await db.fileHandles.delete(HANDLE_KEY)
}

export async function listLocalNotes(): Promise<RemoteEncryptedNote[]> {
  if (!_handle) return []
  const notes: RemoteEncryptedNote[] = []
  for await (const [name, entry] of _handle.entries()) {
    if (entry.kind !== 'file' || !name.startsWith(FILE_PREFIX) || !name.endsWith('.json')) continue
    try {
      const file = await (entry as FileSystemFileHandle).getFile()
      const text = await file.text()
      notes.push({ ...(JSON.parse(text) as RemoteEncryptedNote), fileId: name })
    } catch {
      // Skip malformed files.
    }
  }
  return notes
}

export async function upsertLocalNote(note: RemoteEncryptedNote): Promise<string> {
  if (!_handle) throw new Error('Local folder not connected')
  const name = `${FILE_PREFIX}${note.noteId}.json`
  const fileHandle = await _handle.getFileHandle(name, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(JSON.stringify(note, null, 2))
  await writable.close()
  return name
}
