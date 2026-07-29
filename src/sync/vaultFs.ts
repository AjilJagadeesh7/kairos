/**
 * Vault filesystem primitives — the one place that knows *how* to touch disk.
 *
 * Desktop (Tauri) — plugin-fs + plugin-dialog, rooted at the chosen folder.
 * Mobile (Capacitor) — @capacitor/filesystem, rooted at Documents/Kairos.
 *
 * Every path below is **vault-relative** ("notes/abc.md"); this module maps it
 * onto the platform root. Domain modules (`vaultNotes`, `vaultHistory`, …) are
 * written against these helpers and never import the platform APIs directly.
 */
import { isDesktop } from '../utils/platform'

const TAURI_KEY = 'kairos_plain_folder_path'
const MOBILE_ROOT = 'Kairos'

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
  await Filesystem.deleteFile({ path, directory: Directory.Documents }).catch(() => {})
}

async function mobileMkdir(path: string): Promise<void> {
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  await Filesystem.mkdir({ path, directory: Directory.Documents, recursive: true }).catch(() => {})
}

async function mobileRmdir(path: string): Promise<void> {
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  await Filesystem.rmdir({ path, directory: Directory.Documents, recursive: true }).catch(() => {})
}

// ---------------------------------------------------------------------------
// Init / connect / status
// ---------------------------------------------------------------------------

/** Restore the saved folder and verify it still exists. */
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
    await mobileMkdir(MOBILE_ROOT)
    return 'ok'
  } catch {
    return 'missing'
  }
}

export async function connectPlainFolder(): Promise<void> {
  if (isDesktop()) {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const selected = await open({ directory: true, multiple: false, title: 'Choose Kairos folder' })
    if (!selected || typeof selected !== 'string') return
    _tauriPath = selected
    localStorage.setItem(TAURI_KEY, selected)
    await ensureVaultDirs()
    return
  }

  // Mobile — folder is always Documents/Kairos
  await ensureVaultDirs()
}

export async function disconnectPlainFolder(): Promise<void> {
  if (isDesktop()) {
    _tauriPath = null
    localStorage.removeItem(TAURI_KEY)
  }
  // Mobile — no-op; the app folder can't be disconnected
}

export function getVaultPath(): string | null { return _tauriPath }

export function isPlainFolderConnected(): boolean {
  if (isDesktop()) return _tauriPath !== null
  return true // mobile always has Documents/Kairos
}

export function getPlainFolderName(): string | null {
  if (isDesktop()) return _tauriPath ? (_tauriPath.split(/[/\\]/).pop() ?? _tauriPath) : null
  return MOBILE_ROOT
}

/** Absolute (desktop) or Documents-relative (mobile) path for a vault-relative one. */
function absolute(rel: string): string | null {
  if (!isDesktop()) return `${MOBILE_ROOT}/${rel}`
  return _tauriPath ? `${_tauriPath}/${rel}` : null
}

function parentOf(rel: string): string {
  const i = rel.lastIndexOf('/')
  return i === -1 ? '' : rel.slice(0, i)
}

// ---------------------------------------------------------------------------
// Directories
// ---------------------------------------------------------------------------

export type VaultSubdir = 'notes' | 'kanban' | 'config' | 'journal' | 'canvas' | 'pennotes'

export async function ensureVaultDir(rel: string): Promise<void> {
  if (!rel) return
  if (isDesktop()) {
    if (!_tauriPath) throw new Error('Plain folder not connected')
    const { mkdir } = await import('@tauri-apps/plugin-fs')
    try { await mkdir(`${_tauriPath}/${rel}`, { recursive: true }) } catch { /* already exists */ }
    return
  }
  await mobileMkdir(`${MOBILE_ROOT}/${rel}`)
}

export async function ensureVaultDirs(): Promise<void> {
  const subdirs: VaultSubdir[] = ['notes', 'kanban', 'config', 'journal', 'canvas', 'pennotes']
  await Promise.all(subdirs.map(ensureVaultDir)).catch(() => { /* best-effort */ })
}

/** Filenames directly inside a vault directory; empty when it doesn't exist. */
export async function listVaultDir(rel: string, opts?: { directories?: boolean }): Promise<string[]> {
  if (isDesktop()) {
    if (!_tauriPath) return []
    const { readDir } = await import('@tauri-apps/plugin-fs')
    await ensureVaultDir(rel).catch(() => {})
    try {
      const entries = await readDir(`${_tauriPath}/${rel}`)
      return entries
        .filter(e => !!e.name && (opts?.directories ? e.isDirectory : true))
        .map(e => e.name!)
    } catch { return [] }
  }

  await mobileMkdir(`${MOBILE_ROOT}/${rel}`)
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  try {
    const res = await Filesystem.readdir({ path: `${MOBILE_ROOT}/${rel}`, directory: Directory.Documents })
    return res.files.map(f => f.name)
  } catch { return [] }
}

// ---------------------------------------------------------------------------
// Text files
// ---------------------------------------------------------------------------

export async function writeVaultText(rel: string, content: string): Promise<void> {
  await ensureVaultDir(parentOf(rel))
  if (isDesktop()) {
    const path = absolute(rel)
    if (!path) return
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    await writeTextFile(path, content)
    return
  }
  await mobileWrite(`${MOBILE_ROOT}/${rel}`, content)
}

export async function readVaultText(rel: string): Promise<string | null> {
  if (isDesktop()) {
    const path = absolute(rel)
    if (!path) return null
    const { readTextFile, exists } = await import('@tauri-apps/plugin-fs')
    try {
      if (!(await exists(path))) return null
      return await readTextFile(path)
    } catch { return null }
  }
  return mobileRead(`${MOBILE_ROOT}/${rel}`)
}

export async function removeVaultFile(rel: string): Promise<void> {
  if (isDesktop()) {
    const path = absolute(rel)
    if (!path) return
    const { remove } = await import('@tauri-apps/plugin-fs')
    try { await remove(path) } catch { /* already gone */ }
    return
  }
  await mobileDelete(`${MOBILE_ROOT}/${rel}`)
}

export async function removeVaultDir(rel: string): Promise<void> {
  if (isDesktop()) {
    const path = absolute(rel)
    if (!path) return
    const { remove } = await import('@tauri-apps/plugin-fs')
    await remove(path, { recursive: true }).catch(() => {})
    return
  }
  await mobileRmdir(`${MOBILE_ROOT}/${rel}`)
}

// ---------------------------------------------------------------------------
// Binary files
// ---------------------------------------------------------------------------

export async function writeVaultBytes(rel: string, bytes: Uint8Array): Promise<void> {
  await ensureVaultDir(parentOf(rel))
  if (isDesktop()) {
    const path = absolute(rel)
    if (!path) return
    const { writeFile } = await import('@tauri-apps/plugin-fs')
    await writeFile(path, bytes)
    return
  }
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  await Filesystem.writeFile({
    path: `${MOBILE_ROOT}/${rel}`,
    directory: Directory.Documents,
    data: uint8ToBase64(bytes),
    recursive: true,
  })
}

export async function readVaultBytes(rel: string): Promise<Uint8Array | null> {
  if (isDesktop()) {
    const path = absolute(rel)
    if (!path) return null
    const { readFile } = await import('@tauri-apps/plugin-fs')
    try { return await readFile(path) } catch { return null }
  }
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  try {
    const res = await Filesystem.readFile({ path: `${MOBILE_ROOT}/${rel}`, directory: Directory.Documents })
    return base64ToUint8(res.data as string)
  } catch { return null }
}

/** A webview-loadable URL for a vault file, or null when unavailable. */
export async function vaultFileUrl(rel: string): Promise<string | null> {
  if (isDesktop()) {
    const path = absolute(rel)
    if (!path) return null
    const { convertFileSrc } = await import('@tauri-apps/api/core')
    return convertFileSrc(path)
  }
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  const { Capacitor } = await import('@capacitor/core')
  try {
    const { uri } = await Filesystem.getUri({ path: `${MOBILE_ROOT}/${rel}`, directory: Directory.Documents })
    return Capacitor.convertFileSrc(uri)
  } catch { return null }
}

/** Size in bytes of every file in a directory that passes `keep`. */
export async function vaultDirBytes(rel: string, keep: (name: string) => boolean): Promise<number> {
  if (isDesktop()) {
    if (!_tauriPath) return 0
    const { stat } = await import('@tauri-apps/plugin-fs')
    let total = 0
    for (const name of await listVaultDir(rel)) {
      if (!keep(name)) continue
      try { total += (await stat(`${_tauriPath}/${rel}/${name}`)).size } catch { /* skip */ }
    }
    return total
  }
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  try {
    const res = await Filesystem.readdir({ path: `${MOBILE_ROOT}/${rel}`, directory: Directory.Documents })
    return res.files.reduce((sum, f) => keep(f.name) ? sum + (f.size ?? 0) : sum, 0)
  } catch { return 0 }
}

// ---------------------------------------------------------------------------
// Base64 (mobile binary transport)
// ---------------------------------------------------------------------------

export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return btoa(binary)
}

export function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}
