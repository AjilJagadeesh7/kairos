/**
 * Plain (unencrypted) local folder — primary storage.
 *
 * Vault structure:
 *   {vault}/notes/     — one .md file per note
 *   {vault}/kanban/    — one .json file per board
 *   {vault}/config/    — settings.json and other config
 *
 * Desktop (Tauri) — uses plugin-fs + plugin-dialog.
 * Web — uses File System Access API (Chrome/Edge).
 */
import { isDesktop } from '../utils/platform'
import { db } from '../db/schema'
import { serializeNote, deserializeNote, noteIdToPath } from '../adapters/storage/noteSerializer'
import type { Note } from '../types'
import type { Board } from '../types/kanban.types'

const TAURI_KEY      = 'mindvault_plain_folder_path'
const WEB_HANDLE_KEY = 'plainFolder_vault'

let _tauriPath: string | null                    = null
let _webHandle: FileSystemDirectoryHandle | null = null

// ---------------------------------------------------------------------------
// Init — restores saved folder AND verifies it still exists
// Returns 'ok' | 'missing' | 'none'
// ---------------------------------------------------------------------------

export async function initPlainFolder(): Promise<'ok' | 'missing' | 'none'> {
  if (isDesktop()) {
    const stored = localStorage.getItem(TAURI_KEY)
    if (!stored) return 'none'
    try {
      const { exists } = await import('@tauri-apps/plugin-fs')
      if (await exists(stored)) {
        _tauriPath = stored
        return 'ok'
      }
      // Folder was deleted or moved
      localStorage.removeItem(TAURI_KEY)
      return 'missing'
    } catch {
      localStorage.removeItem(TAURI_KEY)
      return 'missing'
    }
  }

  // Web — restore handle from Dexie
  try {
    const rec = await db.fileHandles.get(WEB_HANDLE_KEY)
    if (!rec?.handle) return 'none'
    const h    = rec.handle as FileSystemDirectoryHandle
    const perm = await h.queryPermission({ mode: 'readwrite' })
    if (perm !== 'granted') return 'none'
    // Verify handle still points to a real directory by trying to iterate
    try {
      for await (const _ of (h as unknown as AsyncIterable<unknown>)) { break }
    } catch {
      _webHandle = null
      await db.fileHandles.delete(WEB_HANDLE_KEY)
      return 'missing'
    }
    _webHandle = h
    return 'ok'
  } catch {
    _webHandle = null
    return 'none'
  }
}

// ---------------------------------------------------------------------------
// Connect / disconnect
// ---------------------------------------------------------------------------

export async function connectPlainFolder(): Promise<void> {
  if (isDesktop()) {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const selected = await open({ directory: true, multiple: false, title: 'Choose MindVault folder' })
    if (!selected || typeof selected !== 'string') return
    _tauriPath = selected
    localStorage.setItem(TAURI_KEY, selected)
    // Ensure subdirectory structure
    await _ensureVaultDirs()
    return
  }
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
  _webHandle   = handle
  await db.fileHandles.put({ key: WEB_HANDLE_KEY, handle: handle as unknown })
  await _ensureVaultDirs()
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
  if (isDesktop()) return _tauriPath ? (_tauriPath.split(/[/\\]/).pop() ?? _tauriPath) : null
  return _webHandle?.name ?? null
}

// ---------------------------------------------------------------------------
// Internal: ensure vault subdirectories exist
// ---------------------------------------------------------------------------

async function _ensureVaultDirs(): Promise<void> {
  await Promise.all([
    _subdirPath('notes'),
    _subdirPath('kanban'),
    _subdirPath('config'),
  ]).catch(() => { /* best-effort */ })
}

/** Returns Tauri path string or Web FSA DirectoryHandle for the named subdir. */
async function _subdirPath(name: 'notes' | 'kanban' | 'config'): Promise<string | FileSystemDirectoryHandle> {
  if (isDesktop()) {
    if (!_tauriPath) throw new Error('Plain folder not connected')
    const { mkdir } = await import('@tauri-apps/plugin-fs')
    const dir = `${_tauriPath}/${name}`
    try { await mkdir(dir, { recursive: true }) } catch { /* already exists */ }
    return dir
  }
  if (!_webHandle) throw new Error('Plain folder not connected')
  return _webHandle.getDirectoryHandle(name, { create: true })
}

// ---------------------------------------------------------------------------
// Notes — vault/notes/*.md
// ---------------------------------------------------------------------------

export async function writePlainNote(note: Note): Promise<void> {
  const content  = serializeNote(note)
  const fileName = noteIdToPath(note.id)

  if (isDesktop()) {
    const dir = await _subdirPath('notes') as string
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    await writeTextFile(`${dir}/${fileName}`, content)
    return
  }

  const dir = await _subdirPath('notes') as FileSystemDirectoryHandle
  const fh  = await dir.getFileHandle(fileName, { create: true })
  const w   = await fh.createWritable()
  await w.write(content)
  await w.close()
}

export async function deletePlainNote(noteId: string): Promise<void> {
  const fileName = noteIdToPath(noteId)

  if (isDesktop()) {
    if (!_tauriPath) return
    const { remove } = await import('@tauri-apps/plugin-fs')
    try { await remove(`${_tauriPath}/notes/${fileName}`) } catch { /* already gone */ }
    return
  }

  if (!_webHandle) return
  try {
    const dir = await _webHandle.getDirectoryHandle('notes', { create: false })
    await dir.removeEntry(fileName)
  } catch { /* already gone */ }
}

export async function readAllNotes(): Promise<Note[]> {
  if (isDesktop()) {
    if (!_tauriPath) return []
    const { readDir, readTextFile, mkdir } = await import('@tauri-apps/plugin-fs')
    const notesPath = `${_tauriPath}/notes`
    try { await mkdir(notesPath, { recursive: true }) } catch { /* exists */ }
    const entries = await readDir(notesPath)
    const notes: Note[] = []
    for (const entry of entries) {
      if (!entry.name?.endsWith('.md')) continue
      try {
        notes.push(deserializeNote(await readTextFile(`${notesPath}/${entry.name}`)))
      } catch { /* skip malformed */ }
    }
    return notes
  }

  if (!_webHandle) return []
  try {
    const dir = await _webHandle.getDirectoryHandle('notes', { create: true })
    const notes: Note[] = []
    for await (const [, handle] of (dir as FileSystemDirectoryHandle & AsyncIterable<[string, FileSystemHandle]>)) {
      if (handle.kind !== 'file' || !handle.name.endsWith('.md')) continue
      try {
        const file = await (handle as FileSystemFileHandle).getFile()
        notes.push(deserializeNote(await file.text()))
      } catch { /* skip */ }
    }
    return notes
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Kanban boards — vault/kanban/*.json
// ---------------------------------------------------------------------------

export async function writePlainBoard(board: Board): Promise<void> {
  const content  = JSON.stringify(board, null, 2)
  const fileName = `${board.id}.json`

  if (isDesktop()) {
    const dir = await _subdirPath('kanban') as string
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    await writeTextFile(`${dir}/${fileName}`, content)
    return
  }

  const dir = await _subdirPath('kanban') as FileSystemDirectoryHandle
  const fh  = await dir.getFileHandle(fileName, { create: true })
  const w   = await fh.createWritable()
  await w.write(content)
  await w.close()
}

export async function deletePlainBoard(boardId: string): Promise<void> {
  const fileName = `${boardId}.json`

  if (isDesktop()) {
    if (!_tauriPath) return
    const { remove } = await import('@tauri-apps/plugin-fs')
    try { await remove(`${_tauriPath}/kanban/${fileName}`) } catch { /* already gone */ }
    return
  }

  if (!_webHandle) return
  try {
    const dir = await _webHandle.getDirectoryHandle('kanban', { create: false })
    await dir.removeEntry(fileName)
  } catch { /* already gone */ }
}

export async function readAllBoards(): Promise<Board[]> {
  if (isDesktop()) {
    if (!_tauriPath) return []
    const { readDir, readTextFile, mkdir } = await import('@tauri-apps/plugin-fs')
    const kanbanPath = `${_tauriPath}/kanban`
    try { await mkdir(kanbanPath, { recursive: true }) } catch { /* exists */ }
    const entries = await readDir(kanbanPath)
    const boards: Board[] = []
    for (const entry of entries) {
      if (!entry.name?.endsWith('.json')) continue
      try {
        boards.push(JSON.parse(await readTextFile(`${kanbanPath}/${entry.name}`)) as Board)
      } catch { /* skip malformed */ }
    }
    return boards
  }

  if (!_webHandle) return []
  try {
    const dir = await _webHandle.getDirectoryHandle('kanban', { create: true })
    const boards: Board[] = []
    for await (const [, handle] of (dir as FileSystemDirectoryHandle & AsyncIterable<[string, FileSystemHandle]>)) {
      if (handle.kind !== 'file' || !handle.name.endsWith('.json')) continue
      try {
        const file = await (handle as FileSystemFileHandle).getFile()
        boards.push(JSON.parse(await file.text()) as Board)
      } catch { /* skip */ }
    }
    return boards
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Config — vault/config/*.json
// ---------------------------------------------------------------------------

export async function readPlainConfig(filename: string): Promise<string | null> {
  if (isDesktop()) {
    if (!_tauriPath) return null
    const { readTextFile, exists } = await import('@tauri-apps/plugin-fs')
    const path = `${_tauriPath}/config/${filename}`
    try {
      if (!(await exists(path))) return null
      return readTextFile(path)
    } catch {
      return null
    }
  }

  if (!_webHandle) return null
  try {
    const dir  = await _webHandle.getDirectoryHandle('config', { create: false })
    const fh   = await dir.getFileHandle(filename)
    const file = await fh.getFile()
    return file.text()
  } catch {
    return null
  }
}

export async function writePlainConfig(filename: string, content: string): Promise<void> {
  if (isDesktop()) {
    const dir = await _subdirPath('config') as string
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    await writeTextFile(`${dir}/${filename}`, content)
    return
  }

  const dir = await _subdirPath('config') as FileSystemDirectoryHandle
  const fh  = await dir.getFileHandle(filename, { create: true })
  const w   = await fh.createWritable()
  await w.write(content)
  await w.close()
}
