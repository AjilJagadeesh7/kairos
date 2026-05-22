/**
 * Plain (unencrypted) local folder — primary storage.
 *
 * Vault structure:
 *   {vault}/notes/          — one .md file per note
 *   {vault}/kanban/         — one .json file per board
 *   {vault}/config/         — settings.json and other config
 *   {vault}/plugins/{id}/   — plugin bundles + data
 *
 * Desktop (Tauri) — uses plugin-fs + plugin-dialog.
 * Mobile (Capacitor) — uses @capacitor/filesystem (Documents/MindVault).
 */
import { isDesktop } from '../utils/platform'
import { serializeNote, deserializeNote, noteIdToPath } from '../adapters/storage/noteSerializer'
import type { Note, JournalEntry, ContentVersion } from '../types'
import type { Board } from '../types/kanban.types'
import type { Canvas } from '../types/canvas.types'

const TAURI_KEY = 'mindvault_plain_folder_path'

let _tauriPath: string | null = null

// ---------------------------------------------------------------------------
// Mobile Capacitor Filesystem Helpers
// ---------------------------------------------------------------------------

async function mobileWrite(path: string, content: string): Promise<void> {
  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
  await Filesystem.writeFile({
    path,
    directory: Directory.Documents,
    data: content,
    encoding: Encoding.UTF8,
    recursive: true,
  })
}

async function mobileRead(path: string): Promise<string | null> {
  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
  try {
    const res = await Filesystem.readFile({
      path,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    })
    return res.data as string
  } catch {
    return null
  }
}

async function mobileDelete(path: string): Promise<void> {
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  await Filesystem.deleteFile({
    path,
    directory: Directory.Documents,
  }).catch(() => {})
}

async function mobileMkdir(path: string): Promise<void> {
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  await Filesystem.mkdir({
    path,
    directory: Directory.Documents,
    recursive: true,
  }).catch(() => {})
}

async function mobileRmdir(path: string): Promise<void> {
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  await Filesystem.rmdir({
    path,
    directory: Directory.Documents,
    recursive: true,
  }).catch(() => {})
}

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
      localStorage.removeItem(TAURI_KEY)
      return 'missing'
    } catch {
      localStorage.removeItem(TAURI_KEY)
      return 'missing'
    }
  }

  // Mobile — always available
  try {
    await mobileMkdir('MindVault')
    return 'ok'
  } catch {
    return 'missing'
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
    await _ensureVaultDirs()
    return
  }

  // Mobile — folder is always Documents/MindVault
  await _ensureVaultDirs()
}

export async function disconnectPlainFolder(): Promise<void> {
  if (isDesktop()) {
    _tauriPath = null
    localStorage.removeItem(TAURI_KEY)
  }
  // Mobile — no-op; the app folder can't be disconnected
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export function isPlainFolderConnected(): boolean {
  if (isDesktop()) return _tauriPath !== null
  return true // mobile always has Documents/MindVault
}

export function getPlainFolderName(): string | null {
  if (isDesktop()) return _tauriPath ? (_tauriPath.split(/[/\\]/).pop() ?? _tauriPath) : null
  return 'MindVault'
}

// ---------------------------------------------------------------------------
// Internal: ensure vault subdirectories exist
// ---------------------------------------------------------------------------

async function _ensureVaultDirs(): Promise<void> {
  await Promise.all([
    _subdirPath('notes'),
    _subdirPath('kanban'),
    _subdirPath('config'),
    _subdirPath('journal'),
    _subdirPath('canvas'),
  ]).catch(() => { /* best-effort */ })
}

async function _subdirPath(name: 'notes' | 'kanban' | 'config' | 'journal' | 'canvas'): Promise<string> {
  if (isDesktop()) {
    if (!_tauriPath) throw new Error('Plain folder not connected')
    const { mkdir } = await import('@tauri-apps/plugin-fs')
    const dir = `${_tauriPath}/${name}`
    try { await mkdir(dir, { recursive: true }) } catch { /* already exists */ }
    return dir
  }
  const dir = `MindVault/${name}`
  await mobileMkdir(dir)
  return dir
}

// ---------------------------------------------------------------------------
// Notes — vault/notes/*.md
// ---------------------------------------------------------------------------

export async function writePlainNote(note: Note): Promise<void> {
  const content  = serializeNote(note)
  const fileName = noteIdToPath(note.id)
  const dir      = await _subdirPath('notes')

  if (isDesktop()) {
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    await writeTextFile(`${dir}/${fileName}`, content)
    return
  }
  await mobileWrite(`${dir}/${fileName}`, content)
}

export async function deletePlainNote(noteId: string): Promise<void> {
  const fileName = noteIdToPath(noteId)

  if (isDesktop()) {
    if (!_tauriPath) return
    const { remove } = await import('@tauri-apps/plugin-fs')
    try { await remove(`${_tauriPath}/notes/${fileName}`) } catch { /* already gone */ }
    return
  }
  await mobileDelete(`MindVault/notes/${fileName}`)
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

  const notesPath = 'MindVault/notes'
  await mobileMkdir(notesPath)
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  try {
    const result = await Filesystem.readdir({ path: notesPath, directory: Directory.Documents })
    const notes: Note[] = []
    for (const entry of result.files) {
      if (!entry.name.endsWith('.md')) continue
      const raw = await mobileRead(`${notesPath}/${entry.name}`)
      if (raw) {
        try { notes.push(deserializeNote(raw)) } catch {}
      }
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
  const dir      = await _subdirPath('kanban')

  if (isDesktop()) {
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    await writeTextFile(`${dir}/${fileName}`, content)
    return
  }
  await mobileWrite(`${dir}/${fileName}`, content)
}

export async function deletePlainBoard(boardId: string): Promise<void> {
  const fileName = `${boardId}.json`

  if (isDesktop()) {
    if (!_tauriPath) return
    const { remove } = await import('@tauri-apps/plugin-fs')
    try { await remove(`${_tauriPath}/kanban/${fileName}`) } catch { /* already gone */ }
    return
  }
  await mobileDelete(`MindVault/kanban/${fileName}`)
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

  const kanbanPath = 'MindVault/kanban'
  await mobileMkdir(kanbanPath)
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  try {
    const result = await Filesystem.readdir({ path: kanbanPath, directory: Directory.Documents })
    const boards: Board[] = []
    for (const entry of result.files) {
      if (!entry.name.endsWith('.json')) continue
      const raw = await mobileRead(`${kanbanPath}/${entry.name}`)
      if (raw) {
        try { boards.push(JSON.parse(raw) as Board) } catch {}
      }
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
  return mobileRead(`MindVault/config/${filename}`)
}

export async function writePlainConfig(filename: string, content: string): Promise<void> {
  const dir = await _subdirPath('config')

  if (isDesktop()) {
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    await writeTextFile(`${dir}/${filename}`, content)
    return
  }
  await mobileWrite(`${dir}/${filename}`, content)
}

// ---------------------------------------------------------------------------
// Journal entries — vault/journal/YYYY-MM-DD.md
// ---------------------------------------------------------------------------

function serializeJournalEntry(entry: JournalEntry): string {
  return `---\ndate: ${entry.date}\nupdatedAt: ${entry.updatedAt}\n---\n\n${entry.content}`
}

function deserializeJournalEntry(raw: string, fallbackDate: string): JournalEntry {
  if (raw.startsWith('---\n')) {
    const rest = raw.slice(4)
    const closeIdx = rest.indexOf('\n---\n')
    if (closeIdx !== -1) {
      const fm = rest.slice(0, closeIdx)
      const body = rest.slice(closeIdx + 5).replace(/^\n/, '')
      const get = (key: string) => fm.match(new RegExp(`^${key}: (.+)$`, 'm'))?.[1] ?? ''
      return { date: get('date') || fallbackDate, content: body, updatedAt: get('updatedAt') || new Date().toISOString() }
    }
  }
  return { date: fallbackDate, content: raw, updatedAt: new Date().toISOString() }
}

export async function writeJournalEntry(entry: JournalEntry): Promise<void> {
  const content  = serializeJournalEntry(entry)
  const fileName = `${entry.date}.md`
  const dir      = await _subdirPath('journal')

  if (isDesktop()) {
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    await writeTextFile(`${dir}/${fileName}`, content)
    return
  }
  await mobileWrite(`${dir}/${fileName}`, content)
}

export async function deleteJournalEntryFile(date: string): Promise<void> {
  const fileName = `${date}.md`

  if (isDesktop()) {
    if (!_tauriPath) return
    const { remove } = await import('@tauri-apps/plugin-fs')
    try { await remove(`${_tauriPath}/journal/${fileName}`) } catch { /* already gone */ }
    return
  }
  await mobileDelete(`MindVault/journal/${fileName}`)
}

export async function readAllJournalEntries(): Promise<JournalEntry[]> {
  if (isDesktop()) {
    if (!_tauriPath) return []
    const { readDir, readTextFile, mkdir } = await import('@tauri-apps/plugin-fs')
    const journalPath = `${_tauriPath}/journal`
    try { await mkdir(journalPath, { recursive: true }) } catch { /* exists */ }
    const entries = await readDir(journalPath)
    const result: JournalEntry[] = []
    for (const entry of entries) {
      if (!entry.name?.endsWith('.md')) continue
      const date = entry.name.slice(0, -3)
      try {
        result.push(deserializeJournalEntry(await readTextFile(`${journalPath}/${entry.name}`), date))
      } catch { /* skip malformed */ }
    }
    return result
  }

  const journalPath = 'MindVault/journal'
  await mobileMkdir(journalPath)
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  try {
    const result = await Filesystem.readdir({ path: journalPath, directory: Directory.Documents })
    const journal: JournalEntry[] = []
    for (const entry of result.files) {
      if (!entry.name.endsWith('.md')) continue
      const date = entry.name.slice(0, -3)
      const raw = await mobileRead(`${journalPath}/${entry.name}`)
      if (raw) {
        try { journal.push(deserializeJournalEntry(raw, date)) } catch {}
      }
    }
    return journal
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Version history — vault/history/notes/{id}.json  |  vault/history/journal/{date}.json
// ---------------------------------------------------------------------------

const MAX_VERSIONS = 50

type HistorySub = 'notes' | 'journal'

async function _historyFilePath(sub: HistorySub, id: string): Promise<string> {
  if (isDesktop()) {
    const { mkdir } = await import('@tauri-apps/plugin-fs')
    const dir = `${_tauriPath}/history/${sub}`
    await mkdir(dir, { recursive: true }).catch(() => {})
    return `${dir}/${id}.json`
  }
  const dir = `MindVault/history/${sub}`
  await mobileMkdir(dir)
  return `${dir}/${id}.json`
}

async function _readHistory(sub: HistorySub, id: string): Promise<ContentVersion[]> {
  try {
    const path = await _historyFilePath(sub, id)
    let raw: string | null = null
    if (isDesktop()) {
      const { readTextFile, exists } = await import('@tauri-apps/plugin-fs')
      if (await exists(path)) raw = await readTextFile(path)
    } else {
      raw = await mobileRead(path)
    }
    if (!raw) return []
    return (JSON.parse(raw) as { versions: ContentVersion[] }).versions ?? []
  } catch {
    return []
  }
}

async function _writeHistory(sub: HistorySub, id: string, versions: ContentVersion[]): Promise<void> {
  const payload = JSON.stringify({ versions })
  const path = await _historyFilePath(sub, id)
  if (isDesktop()) {
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    await writeTextFile(path, payload)
    return
  }
  await mobileWrite(path, payload)
}

export async function appendNoteVersion(noteId: string, version: ContentVersion): Promise<void> {
  if (!isPlainFolderConnected()) return
  const existing = await _readHistory('notes', noteId)
  const updated  = [...existing, version].slice(-MAX_VERSIONS)
  await _writeHistory('notes', noteId, updated)
}

export async function readNoteHistory(noteId: string): Promise<ContentVersion[]> {
  return _readHistory('notes', noteId)
}

export async function deleteNoteHistory(noteId: string): Promise<void> {
  if (isDesktop()) {
    if (!_tauriPath) return
    const { remove } = await import('@tauri-apps/plugin-fs')
    await remove(`${_tauriPath}/history/notes/${noteId}.json`).catch(() => {})
    return
  }
  await mobileDelete(`MindVault/history/notes/${noteId}.json`)
}

export async function appendJournalVersion(date: string, version: ContentVersion): Promise<void> {
  if (!isPlainFolderConnected()) return
  const existing = await _readHistory('journal', date)
  const updated  = [...existing, version].slice(-MAX_VERSIONS)
  await _writeHistory('journal', date, updated)
}

export async function readJournalHistory(date: string): Promise<ContentVersion[]> {
  return _readHistory('journal', date)
}

// ---------------------------------------------------------------------------
// Folder list — vault/config/folders.json (persists explicitly created folders)
// ---------------------------------------------------------------------------

export async function readFolderList(): Promise<string[]> {
  try {
    const raw = await readPlainConfig('folders.json')
    if (!raw) return []
    return (JSON.parse(raw) as { folders: string[] }).folders ?? []
  } catch {
    return []
  }
}

export async function writeFolderList(folders: string[]): Promise<void> {
  await writePlainConfig('folders.json', JSON.stringify({ folders }))
}

// ─── Plugin file helpers ───────────────────────────────────────────────────────

export async function listPluginIds(): Promise<string[]> {
  if (isDesktop()) {
    if (!_tauriPath) return []
    const { readDir, mkdir } = await import('@tauri-apps/plugin-fs')
    const pluginsPath = `${_tauriPath}/plugins`
    try { await mkdir(pluginsPath, { recursive: true }) } catch { /* exists */ }
    try {
      const entries = await readDir(pluginsPath)
      return entries
        .filter(e => e.name && !e.name.startsWith('.') && e.isDirectory)
        .map(e => e.name!)
    } catch { return [] }
  }
  const pluginsPath = 'MindVault/plugins'
  await mobileMkdir(pluginsPath)
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  try {
    const result = await Filesystem.readdir({ path: pluginsPath, directory: Directory.Documents })
    return result.files.filter(e => !e.name.startsWith('.')).map(e => e.name)
  } catch { return [] }
}

export async function readPluginFile(pluginId: string, filename: string): Promise<string | null> {
  if (isDesktop()) {
    if (!_tauriPath) return null
    const { readTextFile, exists } = await import('@tauri-apps/plugin-fs')
    const path = `${_tauriPath}/plugins/${pluginId}/${filename}`
    try {
      if (!(await exists(path))) return null
      return await readTextFile(path)
    } catch { return null }
  }
  return mobileRead(`MindVault/plugins/${pluginId}/${filename}`)
}

export async function writePluginFile(pluginId: string, filename: string, content: string): Promise<void> {
  if (isDesktop()) {
    if (!_tauriPath) throw new Error('Vault not connected')
    const { mkdir, writeTextFile } = await import('@tauri-apps/plugin-fs')
    const dir = `${_tauriPath}/plugins/${pluginId}`
    await mkdir(dir, { recursive: true }).catch(() => {})
    await writeTextFile(`${dir}/${filename}`, content)
    return
  }
  const dir = `MindVault/plugins/${pluginId}`
  await mobileMkdir(dir)
  await mobileWrite(`${dir}/${filename}`, content)
}

export async function deletePluginFolder(pluginId: string): Promise<void> {
  if (isDesktop()) {
    if (!_tauriPath) return
    const { remove } = await import('@tauri-apps/plugin-fs')
    await remove(`${_tauriPath}/plugins/${pluginId}`, { recursive: true }).catch(() => {})
    return
  }
  await mobileRmdir(`MindVault/plugins/${pluginId}`)
}

// ---------------------------------------------------------------------------
// Canvas — vault/canvas/*.json
// ---------------------------------------------------------------------------

export async function writePlainCanvas(canvas: Canvas): Promise<void> {
  const content  = JSON.stringify(canvas, null, 2)
  const fileName = `${canvas.id}.json`
  const dir      = await _subdirPath('canvas')

  if (isDesktop()) {
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    await writeTextFile(`${dir}/${fileName}`, content)
    return
  }
  await mobileWrite(`${dir}/${fileName}`, content)
}

export async function deletePlainCanvas(canvasId: string): Promise<void> {
  const fileName = `${canvasId}.json`

  if (isDesktop()) {
    if (!_tauriPath) return
    const { remove } = await import('@tauri-apps/plugin-fs')
    try { await remove(`${_tauriPath}/canvas/${fileName}`) } catch { /* already gone */ }
    return
  }
  await mobileDelete(`MindVault/canvas/${fileName}`)
}

export async function readAllCanvases(): Promise<Canvas[]> {
  if (isDesktop()) {
    if (!_tauriPath) return []
    const { readDir, readTextFile, mkdir } = await import('@tauri-apps/plugin-fs')
    const canvasPath = `${_tauriPath}/canvas`
    try { await mkdir(canvasPath, { recursive: true }) } catch { /* exists */ }
    const entries = await readDir(canvasPath)
    const canvases: Canvas[] = []
    for (const entry of entries) {
      if (!entry.name?.endsWith('.json')) continue
      try {
        canvases.push(JSON.parse(await readTextFile(`${canvasPath}/${entry.name}`)) as Canvas)
      } catch { /* skip malformed */ }
    }
    return canvases
  }

  const canvasPath = 'MindVault/canvas'
  await mobileMkdir(canvasPath)
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  try {
    const result = await Filesystem.readdir({ path: canvasPath, directory: Directory.Documents })
    const canvases: Canvas[] = []
    for (const entry of result.files) {
      if (!entry.name.endsWith('.json')) continue
      const raw = await mobileRead(`${canvasPath}/${entry.name}`)
      if (raw) {
        try { canvases.push(JSON.parse(raw) as Canvas) } catch {}
      }
    }
    return canvases
  } catch {
    return []
  }
}
