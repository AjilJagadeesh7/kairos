import { serializeNote, deserializeNote, noteIdToPath } from '../adapters/storage/noteSerializer'
import type { Note, SyncCategory } from '../types'
import type { RemoteBlob, RemoteProvider } from './remoteProvider'

const TAURI_PATH_KEY = 'kairos_localfolder_path'

let _tauriPath: string | null = null

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

export async function initLocalFolder(): Promise<void> {
  const stored = localStorage.getItem(TAURI_PATH_KEY)
  if (stored) _tauriPath = stored
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export function isLocalFolderConnected(): boolean {
  return _tauriPath !== null
}

export function getLocalFolderName(): string | null {
  return _tauriPath ? (_tauriPath.split('/').pop() ?? _tauriPath) : null
}

// ---------------------------------------------------------------------------
// Connect / disconnect
// ---------------------------------------------------------------------------

export async function connectLocalFolder(): Promise<void> {
  const { open } = await import('@tauri-apps/plugin-dialog')
  const selected = await open({ directory: true, multiple: false, title: 'Choose Kairos sync folder' })
  if (!selected || typeof selected !== 'string') return
  _tauriPath = selected
  localStorage.setItem(TAURI_PATH_KEY, selected)
}

export async function disconnectLocalFolder(): Promise<void> {
  _tauriPath = null
  localStorage.removeItem(TAURI_PATH_KEY)
}

// ---------------------------------------------------------------------------
// Read / write — plain .md
// ---------------------------------------------------------------------------

export async function listLocalNotes(): Promise<Note[]> {
  return _listTauri()
}

export async function upsertLocalNote(note: Note): Promise<string> {
  return _upsertTauri(note)
}

export async function deleteLocalNote(noteId: string): Promise<void> {
  if (!_tauriPath) return
  const { remove } = await import('@tauri-apps/plugin-fs')
  try { await remove(`${_tauriPath}/${noteIdToPath(noteId)}`) } catch { /* already gone */ }
}

// ---------------------------------------------------------------------------
// Generic blob API — keyed by category subfolder ({path}/{category}/{file})
// ---------------------------------------------------------------------------

export async function putLocalBlob(category: SyncCategory, filename: string, content: string): Promise<void> {
  if (!_tauriPath) throw new Error('Local folder not connected')
  const { writeTextFile, mkdir } = await import('@tauri-apps/plugin-fs')
  const dir = `${_tauriPath}/${category}`
  await mkdir(dir, { recursive: true }).catch(() => { /* already exists */ })
  await writeTextFile(`${dir}/${filename}`, content)
}

export async function listLocalBlob(category: SyncCategory): Promise<RemoteBlob[]> {
  if (!_tauriPath) return []
  const { readDir, readTextFile, mkdir } = await import('@tauri-apps/plugin-fs')
  const dir = `${_tauriPath}/${category}`
  try { await mkdir(dir, { recursive: true }) } catch { /* exists */ }
  const entries = await readDir(dir)
  const blobs: RemoteBlob[] = []
  for (const entry of entries) {
    const name = entry.name ?? ''
    if (!name || entry.isDirectory) continue
    try {
      blobs.push({ name, content: await readTextFile(`${dir}/${name}`) })
    } catch { /* skip */ }
  }
  return blobs
}

export async function deleteLocalBlob(category: SyncCategory, filename: string): Promise<void> {
  if (!_tauriPath) return
  const { remove } = await import('@tauri-apps/plugin-fs')
  try { await remove(`${_tauriPath}/${category}/${filename}`) } catch { /* already gone */ }
}

export const localFolderProvider: RemoteProvider = {
  id: 'localFolder',
  isConnected: isLocalFolderConnected,
  putBlob: putLocalBlob,
  listBlob: listLocalBlob,
  deleteBlob: deleteLocalBlob,
}

// ---------------------------------------------------------------------------
// Config subdir helpers — used by settingsSync.ts
// ---------------------------------------------------------------------------

export async function writeToSyncSubdir(subdir: string, filename: string, content: string): Promise<void> {
  if (!_tauriPath) throw new Error('Local folder not connected')
  const { writeTextFile, mkdir } = await import('@tauri-apps/plugin-fs')
  const dir = `${_tauriPath}/${subdir}`
  await mkdir(dir, { recursive: true }).catch(() => { /* already exists */ })
  await writeTextFile(`${dir}/${filename}`, content)
}

export async function readFromSyncSubdir(subdir: string, filename: string): Promise<string | null> {
  if (!_tauriPath) return null
  const { readTextFile, exists } = await import('@tauri-apps/plugin-fs')
  const path = `${_tauriPath}/${subdir}/${filename}`
  if (!(await exists(path))) return null
  return readTextFile(path)
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
