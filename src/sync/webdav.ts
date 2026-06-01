/**
 * WebDAV sync provider — plain .md files, no encryption.
 * Works with Nextcloud, ownCloud, Koofr, pCloud, Box, any NAS.
 */
import { serializeNote, deserializeNote, noteIdToPath } from '../adapters/storage/noteSerializer'
import { isDesktop, isMobile } from '../utils/platform'
import type { Note, SyncCategory } from '../types'
import type { RemoteBlob, RemoteProvider } from './remoteProvider'

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

interface DavResult {
  status: number
  ok: boolean
  text: () => Promise<string>
}

interface DavInit {
  method: string
  headers: Record<string, string>
  body?: string
}

/**
 * Single WebDAV transport that bypasses WebView CORS on native platforms.
 *
 * WebDAV verbs (PROPFIND, MKCOL, …) and the Authorization/Depth headers are
 * "non-simple", so the browser fires a CORS preflight (OPTIONS) that servers
 * like Koofr answer with 401 → the request never runs. We avoid the browser
 * network stack entirely:
 *
 *  - Desktop (Tauri): rewrite https:// → mvproxy:// so the Rust scheme handler
 *    performs the request server-side (it answers preflight locally and
 *    forwards every verb + body).
 *  - Mobile (Capacitor): use the native HTTP bridge, not subject to CORS.
 *  - Web: plain fetch (works only if the server sends CORS headers).
 */
async function davFetch(url: string, init: DavInit): Promise<DavResult> {
  if (isMobile()) {
    const { CapacitorHttp } = await import('@capacitor/core')
    const res = await CapacitorHttp.request({
      url,
      method: init.method,
      headers: init.headers,
      data: init.body,
      responseType: 'text',
    })
    const text = typeof res.data === 'string' ? res.data : (res.data == null ? '' : String(res.data))
    return {
      status: res.status,
      ok: res.status >= 200 && res.status < 300,
      text: () => Promise.resolve(text),
    }
  }

  // Desktop: rewrite to the mvproxy:// scheme handled by Rust; web: unchanged.
  const target = isDesktop() ? url.replace(/^https?:\/\//, 'mvproxy://') : url
  const res = await fetch(target, { method: init.method, headers: init.headers, body: init.body })
  return { status: res.status, ok: res.ok, text: () => res.text() }
}

function originOf(url: string): string {
  const u = new URL(url)
  return `${u.protocol}//${u.host}`
}

async function ensureDir(baseUrl: string, authHeader: string): Promise<void> {
  const url = baseUrl.replace(/\/?$/, '/')
  const res = await davFetch(url, { method: 'MKCOL', headers: { Authorization: authHeader } })
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

  const res = await davFetch(baseUrl + '/', {
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
      const fileRes = await davFetch(fileUrl, { method: 'GET', headers: { Authorization: authHeader } })
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

  const res = await davFetch(fileUrl, {
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
  const res     = await davFetch(fileUrl, {
    method: 'DELETE',
    headers: { Authorization: basicAuth(cfg.username, cfg.password) },
  })
  if (!res.ok && res.status !== 404) throw new Error(`WebDAV DELETE failed: ${res.status}`)
}

// ---------------------------------------------------------------------------
// Generic blob API — keyed by category subfolder ({url}/{category}/{file})
// ---------------------------------------------------------------------------

function contentTypeFor(filename: string): string {
  return filename.endsWith('.json')
    ? 'application/json; charset=utf-8'
    : 'text/markdown; charset=utf-8'
}

function categoryUrl(cfg: WebDAVConfig, category: SyncCategory): string {
  return `${cfg.url.replace(/\/$/, '')}/${category}`
}

export async function putWebDAVBlob(category: SyncCategory, filename: string, content: string): Promise<void> {
  const cfg = _config
  if (!cfg) throw new Error('WebDAV not configured')
  const authHeader = basicAuth(cfg.username, cfg.password)
  const baseUrl    = categoryUrl(cfg, category)
  await ensureDir(baseUrl, authHeader)

  const res = await davFetch(`${baseUrl}/${filename}`, {
    method: 'PUT',
    headers: { Authorization: authHeader, 'Content-Type': contentTypeFor(filename) },
    body: content,
  })
  if (!res.ok && res.status !== 201 && res.status !== 204) {
    throw new Error(`WebDAV PUT failed: ${res.status}`)
  }
}

export async function listWebDAVBlob(category: SyncCategory): Promise<RemoteBlob[]> {
  const cfg = _config
  if (!cfg) throw new Error('WebDAV not configured')
  const baseUrl    = categoryUrl(cfg, category)
  const authHeader = basicAuth(cfg.username, cfg.password)

  await ensureDir(baseUrl, authHeader)

  const res = await davFetch(baseUrl + '/', {
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

  // Files only (skip the collection itself — it has no filename extension)
  const hrefs = Array.from(doc.getElementsByTagNameNS('DAV:', 'response'))
    .map((r) => r.getElementsByTagNameNS('DAV:', 'href')[0]?.textContent ?? '')
    .filter((href) => !href.endsWith('/') && /\.[a-z0-9]+$/i.test(href))

  const blobs: RemoteBlob[] = []
  for (const href of hrefs) {
    try {
      const fileUrl = href.startsWith('http') ? href : `${origin}${href}`
      const fileRes = await davFetch(fileUrl, { method: 'GET', headers: { Authorization: authHeader } })
      if (!fileRes.ok) continue
      const name = decodeURIComponent(href.split('/').pop() ?? '')
      blobs.push({ name, content: await fileRes.text() })
    } catch (err) {
      console.warn('WebDAV: skipping', href, err)
    }
  }
  return blobs
}

export async function deleteWebDAVBlob(category: SyncCategory, filename: string): Promise<void> {
  const cfg = _config
  if (!cfg) throw new Error('WebDAV not configured')
  const res = await davFetch(`${categoryUrl(cfg, category)}/${filename}`, {
    method: 'DELETE',
    headers: { Authorization: basicAuth(cfg.username, cfg.password) },
  })
  if (!res.ok && res.status !== 404) throw new Error(`WebDAV DELETE failed: ${res.status}`)
}

export const webdavProvider: RemoteProvider = {
  id: 'webdav',
  isConnected: isWebDAVConnected,
  putBlob: putWebDAVBlob,
  listBlob: listWebDAVBlob,
  deleteBlob: deleteWebDAVBlob,
}

/** Verify the server URL and credentials. */
export async function testWebDAVConnection(cfg: WebDAVConfig): Promise<void> {
  const url = cfg.url.replace(/\/?$/, '/')
  const res = await davFetch(url, {
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
