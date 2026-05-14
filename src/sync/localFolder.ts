import { db } from '../db/schema'
import { isDesktop } from '../utils/platform'
import { serializeNote, deserializeNote, noteIdToPath } from '../adapters/storage/noteSerializer'
import type { Note } from '../types'

const HANDLE_KEY     = 'localFolderHandle'
const TAURI_PATH_KEY = 'mindvault_localfolder_path'

let _handle:    FileSystemDirectoryHandle | null = null
let _tauriPath: string | null                    = null

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

export async function initLocalFolder(): Promise<void> {
  if (isDesktop()) {
    const stored = localStorage.getItem(TAURI_PATH_KEY)
    if (stored) _tauriPath = stored
    return
  }
  try {
    const rec  = await db.fileHandles.get(HANDLE_KEY)
    if (!rec?.handle) return
    const h    = rec.handle as FileSystemDirectoryHandle
    const perm = await h.queryPermission({ mode: 'readwrite' })
    if (perm === 'granted') _handle = h
  } catch {
    _handle = null
  }
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export function isLocalFolderConnected(): boolean {
  return isDesktop() ? _tauriPath !== null : _handle !== null
}

export function getLocalFolderName(): string | null {
  if (isDesktop()) return _tauriPath ? (_tauriPath.split('/').pop() ?? _tauriPath) : null
  return _handle?.name ?? null
}

// ---------------------------------------------------------------------------
// Connect / disconnect
// ---------------------------------------------------------------------------

export async function connectLocalFolder(): Promise<void> {
  if (isDesktop()) {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const selected = await open({ directory: true, multiple: false, title: 'Choose MindVault sync folder' })
    if (!selected || typeof selected !== 'string') return
    _tauriPath = selected
    localStorage.setItem(TAURI_PATH_KEY, selected)
    return
  }

  try {
    const rec = await db.fileHandles.get(HANDLE_KEY)
    if (rec?.handle) {
      const h    = rec.handle as FileSystemDirectoryHandle
      const perm = await h.requestPermission({ mode: 'readwrite' })
      if (perm === 'granted') { _handle = h; return }
    }
  } catch { /* fall through */ }

  const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
  _handle = handle
  await db.fileHandles.put({ key: HANDLE_KEY, handle: handle as unknown })
}

export async function disconnectLocalFolder(): Promise<void> {
  if (isDesktop()) {
    _tauriPath = null
    localStorage.removeItem(TAURI_PATH_KEY)
    return
  }
  _handle = null
  await db.fileHandles.delete(HANDLE_KEY)
}

// ---------------------------------------------------------------------------
// Read / write — plain .md
// ---------------------------------------------------------------------------

export async function listLocalNotes(): Promise<Note[]> {
  if (isDesktop()) return _listTauri()

  if (!_handle) return []
  const notes: Note[] = []
  for await (const [name, entry] of _handle.entries()) {
    if (entry.kind !== 'file' || !name.endsWith('.md')) continue
    try {
      const file = await (entry as FileSystemFileHandle).getFile()
      const note = deserializeNote(await file.text())
      notes.push({ ...note, embedding: note.embedding ?? [] })
    } catch { /* skip malformed */ }
  }
  return notes
}

export async function upsertLocalNote(note: Note): Promise<string> {
  if (isDesktop()) return _upsertTauri(note)

  if (!_handle) throw new Error('Local folder not connected')
  const name     = noteIdToPath(note.id)
  const fh       = await _handle.getFileHandle(name, { create: true })
  const writable = await fh.createWritable()
  await writable.write(serializeNote(note))
  await writable.close()
  return name
}

export async function deleteLocalNote(noteId: string): Promise<void> {
  if (isDesktop()) {
    if (!_tauriPath) return
    const { remove } = await import('@tauri-apps/plugin-fs')
    try { await remove(`${_tauriPath}/${noteIdToPath(noteId)}`) } catch { /* already gone */ }
    return
  }
  if (!_handle) return
  try { await _handle.removeEntry(noteIdToPath(noteId)) } catch { /* already gone */ }
}

// ---------------------------------------------------------------------------
// Config subdir helpers — used by settingsSync.ts
// ---------------------------------------------------------------------------

export async function writeToSyncSubdir(subdir: string, filename: string, content: string): Promise<void> {
  if (isDesktop()) {
    if (!_tauriPath) throw new Error('Local folder not connected')
    const { writeTextFile, mkdir } = await import('@tauri-apps/plugin-fs')
    const dir = `${_tauriPath}/${subdir}`
    await mkdir(dir, { recursive: true }).catch(() => { /* already exists */ })
    await writeTextFile(`${dir}/${filename}`, content)
    return
  }
  if (!_handle) throw new Error('Local folder not connected')
  const dirHandle = await _handle.getDirectoryHandle(subdir, { create: true })
  const fh        = await dirHandle.getFileHandle(filename, { create: true })
  const writable  = await fh.createWritable()
  await writable.write(content)
  await writable.close()
}

export async function readFromSyncSubdir(subdir: string, filename: string): Promise<string | null> {
  if (isDesktop()) {
    if (!_tauriPath) return null
    const { readTextFile, exists } = await import('@tauri-apps/plugin-fs')
    const path = `${_tauriPath}/${subdir}/${filename}`
    if (!(await exists(path))) return null
    return readTextFile(path)
  }
  if (!_handle) return null
  try {
    const dirHandle  = await _handle.getDirectoryHandle(subdir)
    const fh         = await dirHandle.getFileHandle(filename)
    const file       = await fh.getFile()
    return file.text()
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Tauri helpers
// ---------------------------------------------------------------------------

async function _listTauri(): Promise<Note[]> {
  if (!_tauriPath) return []
  const { readDir, readTextFile } = await import('@tauri-apps/plugin-fs')
  const entries = await readDir(_tauriPath)
  const notes: Note[] = []
  for (const entry of entries) {
    const name = entry.name ?? ''
    if (!name.endsWith('.md')) continue
    try {
      const note = deserializeNote(await readTextFile(`${_tauriPath}/${name}`))
      notes.push({ ...note, embedding: note.embedding ?? [] })
    } catch { /* skip */ }
  }
  return notes
}

async function _upsertTauri(note: Note): Promise<string> {
  if (!_tauriPath) throw new Error('Local folder not connected')
  const { writeTextFile } = await import('@tauri-apps/plugin-fs')
  const name = noteIdToPath(note.id)
  await writeTextFile(`${_tauriPath}/${name}`, serializeNote(note))
  return name
}
