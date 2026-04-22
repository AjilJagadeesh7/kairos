/**
 * WebDAV sync provider.
 * Works with Nextcloud, ownCloud, Koofr, pCloud, Box, any NAS (Synology, QNAP, TrueNAS),
 * and any self-hosted WebDAV server.
 *
 * User provides a base URL pointing to their MindVault directory, e.g.:
 *   https://cloud.example.com/remote.php/dav/files/alice/MindVault
 *
 * Auth uses HTTP Basic (username + password / app password).
 * Notes are stored as JSON files: {baseUrl}/{noteId}.json
 */
import type { RemoteEncryptedNote } from './types'

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

export function setWebDAVConfig(cfg: WebDAVConfig | null): void {
  _config = cfg
}

export function getWebDAVConfig(): WebDAVConfig | null {
  return _config
}

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

/** Create the directory if it doesn't exist (404 → MKCOL). 405 means it already exists. */
async function ensureDir(baseUrl: string, authHeader: string): Promise<void> {
  const url = baseUrl.replace(/\/?$/, '/')
  const res = await fetch(url, {
    method: 'MKCOL',
    headers: { Authorization: authHeader },
  })
  // 201 = created, 405 = already exists, 301/302 = redirect (treat as ok)
  if (!res.ok && res.status !== 405) {
    throw new Error(`WebDAV: could not create directory (${res.status})`)
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function listWebDAVNotes(): Promise<RemoteEncryptedNote[]> {
  const cfg = _config
  if (!cfg) throw new Error('WebDAV not configured')

  const baseUrl    = cfg.url.replace(/\/$/, '')
  const authHeader = basicAuth(cfg.username, cfg.password)

  await ensureDir(baseUrl, authHeader)

  const propfindRes = await fetch(baseUrl + '/', {
    method:  'PROPFIND',
    headers: {
      Authorization:   authHeader,
      Depth:           '1',
      'Content-Type':  'application/xml',
    },
    body: `<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:displayname/></d:prop></d:propfind>`,
  })

  if (!propfindRes.ok) {
    if (propfindRes.status === 401) throw new Error('WebDAV: invalid credentials')
    throw new Error(`WebDAV PROPFIND failed: ${propfindRes.status}`)
  }

  const xml  = await propfindRes.text()
  const doc  = new DOMParser().parseFromString(xml, 'text/xml')
  const origin = originOf(baseUrl)

  // getElementsByTagNameNS handles namespace-prefixed elements correctly.
  const hrefs = Array.from(doc.getElementsByTagNameNS('DAV:', 'response'))
    .map((r) => r.getElementsByTagNameNS('DAV:', 'href')[0]?.textContent ?? '')
    .filter((href) => href.endsWith('.json'))

  const notes: RemoteEncryptedNote[] = []
  for (const href of hrefs) {
    try {
      const fileUrl = href.startsWith('http') ? href : `${origin}${href}`
      const res     = await fetch(fileUrl, { headers: { Authorization: authHeader } })
      if (!res.ok) continue
      const note       = (await res.json()) as RemoteEncryptedNote
      note.fileId      = fileUrl
      notes.push(note)
    } catch (err) {
      console.warn('WebDAV: skipping', href, err)
    }
  }
  return notes
}

export async function upsertWebDAVNote(
  note: RemoteEncryptedNote,
  _existingUrl?: string,
): Promise<string> {
  const cfg = _config
  if (!cfg) throw new Error('WebDAV not configured')

  const baseUrl    = cfg.url.replace(/\/$/, '')
  const authHeader = basicAuth(cfg.username, cfg.password)
  const fileUrl    = `${baseUrl}/${note.noteId}.json`

  const res = await fetch(fileUrl, {
    method:  'PUT',
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    body:    JSON.stringify(note),
  })

  if (!res.ok && res.status !== 201 && res.status !== 204) {
    throw new Error(`WebDAV PUT failed: ${res.status}`)
  }
  return fileUrl
}

/** Verify the server URL and credentials. Throws a descriptive error on failure. */
export async function testWebDAVConnection(cfg: WebDAVConfig): Promise<void> {
  const url        = cfg.url.replace(/\/?$/, '/')
  const authHeader = basicAuth(cfg.username, cfg.password)

  const res = await fetch(url, {
    method:  'PROPFIND',
    headers: {
      Authorization:  authHeader,
      Depth:          '0',
      'Content-Type': 'application/xml',
    },
    body: `<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>`,
  })

  if (res.status === 401) throw new Error('Invalid username or password')
  if (res.status === 403) throw new Error('Access denied — check permissions')
  if (res.status === 404) throw new Error('Directory not found — check your WebDAV URL')
  if (res.status !== 207 && !res.ok) throw new Error(`WebDAV server returned ${res.status}`)
}
