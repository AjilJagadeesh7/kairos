/**
 * Plain (unencrypted) local folder writes.
 * Writes notes as readable .md files (frontmatter + content) to a user-chosen
 * folder. Separate from the encrypted sync localFolder.ts.
 *
 * Desktop (Tauri) — uses plugin-fs + plugin-dialog.
 * Web — uses File System Access API (Chrome/Edge).
 */
import { isDesktop } from '../utils/platform'
import { db } from '../db/schema'
import { serializeNote, noteIdToPath } from '../adapters/storage/noteSerializer'
import type { Note } from '../types'

const TAURI_KEY   = 'mindvault_plain_folder_path'
const WEB_HANDLE_KEY = 'plainFolder_vault'

let _tauriPath:  string | null                    = null
let _webHandle:  FileSystemDirectoryHandle | null = null

// ---------------------------------------------------------------------------
// Init (call on app startup to restore a previously connected folder)
// ---------------------------------------------------------------------------

export async function initPlainFolder(): Promise<void> {
  if (isDesktop()) {
    _tauriPath = localStorage.getItem(TAURI_KEY)
    return
  }
  try {
    const rec = await db.fileHandles.get(WEB_HANDLE_KEY)
    if (!rec?.handle) return
    const h    = rec.handle as FileSystemDirectoryHandle
    const perm = await h.queryPermission({ mode: 'readwrite' })
    if (perm === 'granted') _webHandle = h
  } catch {
    _webHandle = null
  }
}

// ---------------------------------------------------------------------------
// Connect / disconnect
// ---------------------------------------------------------------------------

export async function connectPlainFolder(): Promise<void> {
  if (isDesktop()) {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const selected = await open({ directory: true, multiple: false, title: 'Choose notes folder' })
    if (!selected || typeof selected !== 'string') return
    _tauriPath = selected
    localStorage.setItem(TAURI_KEY, selected)
    return
  }
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
  _webHandle   = handle
  await db.fileHandles.put({ key: WEB_HANDLE_KEY, handle: handle as unknown })
}

export async function disconnectPlainFolder(): Promise<void> {
  if (isDesktop()) {
    _tauriPath = null
    localStorage.removeItem(TAURI_KEY)
    return
  }
  _webHandle = null
  await db.fileHandles.delete(WEB_HANDLE_KEY)
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export function isPlainFolderConnected(): boolean {
  return isDesktop() ? _tauriPath !== null : _webHandle !== null
}

export function getPlainFolderName(): string | null {
  if (isDesktop()) return _tauriPath ? (_tauriPath.split('/').pop() ?? _tauriPath) : null
  return _webHandle?.name ?? null
}

// ---------------------------------------------------------------------------
// Read / write
// ---------------------------------------------------------------------------

export async function writePlainNote(note: Note): Promise<void> {
  const content  = serializeNote(note)
  const fileName = noteIdToPath(note.id)

  if (isDesktop()) {
    if (!_tauriPath) throw new Error('Plain folder not connected')
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    await writeTextFile(`${_tauriPath}/${fileName}`, content)
    return
  }

  if (!_webHandle) throw new Error('Plain folder not connected')
  const fh       = await _webHandle.getFileHandle(fileName, { create: true })
  const writable = await fh.createWritable()
  await writable.write(content)
  await writable.close()
}

export async function deletePlainNote(noteId: string): Promise<void> {
  const fileName = noteIdToPath(noteId)

  if (isDesktop()) {
    if (!_tauriPath) return
    const { remove } = await import('@tauri-apps/plugin-fs')
    try { await remove(`${_tauriPath}/${fileName}`) } catch { /* already gone */ }
    return
  }

  if (!_webHandle) return
  try { await _webHandle.removeEntry(fileName) } catch { /* already gone */ }
}
