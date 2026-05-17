/**
 * WebDAV sync provider — plain .md files, no encryption.
 * Works with Nextcloud, ownCloud, Koofr, pCloud, Box, any NAS.
 */
import { serializeNote, deserializeNote, noteIdToPath } from '../adapters/storage/noteSerializer'
import type { Note } from '../types'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export type WebDAVConfig = {
  /** Full URL to the sync directory, no trailing slash. */
  url: string
  username: string
  password: string
}

let _config: WebDAVConfig | null = null

export function setWebDAVConfig(cfg: WebDAVConfig | null): void { _config = cfg }
export function getWebDAVConfig(): WebDAVConfig | null           { return _config }

export function isWebDAVConnected(): boolean {
  return _config !== null && Boolean(_config.url && _config.username && _config.password)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function basicAuth(username: string, password: string): string {
  return 'Basic ' + btoa(`${username}:${password}`)
}

function originOf(url: string): string {
  const u = new URL(url)
  return `${u.protocol}//${u.host}`
}

async function ensureDir(baseUrl: string, authHeader: string): Promise<void> {
  const url = baseUrl.replace(/\/?$/, '/')
  const res = await fetch(url, { method: 'MKCOL', headers: { Authorization: authHeader } })
  if (!res.ok && res.status !== 405) throw new Error(`WebDAV: could not create directory (${res.status})`)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Notes are stored under a notes/ subpath inside the configured URL
function notesUrl(cfg: WebDAVConfig): string {
  return `${cfg.url.replace(/\/$/, '')}/notes`
}

export async function listWebDAVNotes(): Promise<Note[]> {
  const cfg = _config
  if (!cfg) throw new Error('WebDAV not configured')

  const baseUrl    = notesUrl(cfg)
  const authHeader = basicAuth(cfg.username, cfg.password)

  await ensureDir(baseUrl, authHeader)

  const res = await fetch(baseUrl + '/', {
    method: 'PROPFIND',
    headers: { Authorization: authHeader, Depth: '1', 'Content-Type': 'application/xml' },
    body: `<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:displayname/></d:prop></d:propfind>`,
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error('WebDAV: invalid credentials')
    throw new Error(`WebDAV PROPFIND failed: ${res.status}`)
  }

  const xml    = await res.text()
  const doc    = new DOMParser().parseFromString(xml, 'text/xml')
  const origin = originOf(baseUrl)

  const hrefs = Array.from(doc.getElementsByTagNameNS('DAV:', 'response'))
    .map((r) => r.getElementsByTagNameNS('DAV:', 'href')[0]?.textContent ?? '')
    .filter((href) => href.endsWith('.md'))

  const notes: Note[] = []
  for (const href of hrefs) {
    try {
      const fileUrl = href.startsWith('http') ? href : `${origin}${href}`
      const fileRes = await fetch(fileUrl, { headers: { Authorization: authHeader } })
      if (!fileRes.ok) continue
      const note = deserializeNote(await fileRes.text())
      notes.push({ ...note, embedding: note.embedding ?? [] })
    } catch (err) {
      console.warn('WebDAV: skipping', href, err)
    }
  }
  return notes
}

export async function upsertWebDAVNote(note: Note): Promise<string> {
  const cfg = _config
  if (!cfg) throw new Error('WebDAV not configured')

  const authHeader = basicAuth(cfg.username, cfg.password)
  const fileUrl    = `${notesUrl(cfg)}/${noteIdToPath(note.id)}`

  const res = await fetch(fileUrl, {
    method: 'PUT',
    headers: { Authorization: authHeader, 'Content-Type': 'text/markdown; charset=utf-8' },
    body: serializeNote(note),
  })

  if (!res.ok && res.status !== 201 && res.status !== 204) {
    throw new Error(`WebDAV PUT failed: ${res.status}`)
  }
  return fileUrl
}

export async function deleteWebDAVNote(noteId: string): Promise<void> {
  const cfg = _config
  if (!cfg) throw new Error('WebDAV not configured')
  const fileUrl = `${notesUrl(cfg)}/${noteIdToPath(noteId)}`
  const res     = await fetch(fileUrl, {
    method: 'DELETE',
    headers: { Authorization: basicAuth(cfg.username, cfg.password) },
  })
  if (!res.ok && res.status !== 404) throw new Error(`WebDAV DELETE failed: ${res.status}`)
}

/** Verify the server URL and credentials. */
export async function testWebDAVConnection(cfg: WebDAVConfig): Promise<void> {
  const url = cfg.url.replace(/\/?$/, '/')
  const res = await fetch(url, {
    method: 'PROPFIND',
    headers: {
      Authorization: basicAuth(cfg.username, cfg.password),
      Depth: '0', 'Content-Type': 'application/xml',
    },
    body: `<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>`,
  })
  if (res.status === 401) throw new Error('Invalid username or password')
  if (res.status === 403) throw new Error('Access denied — check permissions')
  if (res.status === 404) throw new Error('Directory not found — check your WebDAV URL')
  if (res.status !== 207 && !res.ok) throw new Error(`WebDAV server returned ${res.status}`)
}

/** Quick reachability check using stored config. Returns error message or null. */
export async function pingWebDAV(): Promise<string | null> {
  if (!_config) return null
  try {
    await testWebDAVConnection(_config)
    return null
  } catch (err) {
    return err instanceof Error ? err.message : 'WebDAV unreachable'
  }
}
