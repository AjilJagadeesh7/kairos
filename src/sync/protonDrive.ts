/**
 * Proton Drive sync via WebDAV.
 *
 * In development the Vite dev server proxies /proton-dav → https://dav.proton.me
 * so the browser never makes a cross-origin request. In a self-hosted production build
 * you will need an equivalent reverse-proxy rule (nginx, Caddy, etc.).
 *
 * Proton requires an "App Password" (not your main Proton password when 2FA is on).
 * Generate one at: Account Settings → Security → App passwords.
 */

import type { RemoteEncryptedNote } from './types'

const BASE = '/proton-dav'
const DIR = `${BASE}/MindVault`
const FILE_PREFIX = 'mindvault-note-'

type Creds = { username: string; password: string }

// Credentials are kept in memory for the lifetime of the page.
// The username is also mirrored to sessionStorage so the input field
// re-populates after a hot-reload without exposing it long-term.
let _creds: Creds | null = null

function authHeader(c: Creds): string {
  return 'Basic ' + btoa(`${c.username}:${c.password}`)
}

/** Returns the username that was used to connect this session, if any. */
export function getProtonUsername(): string {
  return sessionStorage.getItem('proton_dav_user') ?? ''
}

export function isProtonConnected(): boolean {
  return _creds !== null
}

/**
 * Verify credentials against the WebDAV root and create the MindVault
 * directory if it does not already exist.
 */
export async function connectProton(username: string, password: string): Promise<void> {
  const creds: Creds = { username, password }

  // Verify credentials by attempting to create (or confirm existence of) the
  // MindVault directory. MKCOL returns:
  //   201 = directory created  → auth OK, dir created
  //   405 = method not allowed → directory already exists, auth OK
  //   401 = unauthorized       → wrong credentials
  //   403 = forbidden          → auth OK but no permission (shouldn't happen)
  //   502/503/504              → proxy/gateway error, not an auth problem
  let mkcolStatus: number
  try {
    const mkcolResp = await fetch(`${DIR}/`, {
      method: 'MKCOL',
      headers: { Authorization: authHeader(creds) },
    })
    mkcolStatus = mkcolResp.status
  } catch (err) {
    throw new Error(
      'Could not reach Proton Drive WebDAV. ' +
      'Make sure the Vite dev server is running (npm run dev) and try again.',
    )
  }

  if (mkcolStatus === 401) {
    throw new Error('Wrong username or App Password (401 Unauthorized).')
  }
  if (mkcolStatus === 502 || mkcolStatus === 503 || mkcolStatus === 504) {
    throw new Error(
      `Gateway error (${mkcolStatus}) — the Vite dev proxy could not reach Proton Drive. ` +
      'Check that the dev server is running and that dav.drive.proton.me is reachable.',
    )
  }
  // 201 = created, 405 = already exists, 403 = exists but not MKCOL-able → all mean auth worked.
  if (mkcolStatus !== 201 && mkcolStatus !== 405 && mkcolStatus !== 403) {
    throw new Error(`Unexpected response from Proton Drive (${mkcolStatus}). Try again later.`)
  }

  _creds = creds
  sessionStorage.setItem('proton_dav_user', username)
}

export function disconnectProton(): void {
  _creds = null
  sessionStorage.removeItem('proton_dav_user')
}

/** Convert an href from PROPFIND (may be absolute URL) into a proxy-relative path. */
function toProxyPath(href: string): string {
  try {
    const url = new URL(href)
    return `${BASE}${url.pathname}`
  } catch {
    return href.startsWith('/') ? `${BASE}${href}` : href
  }
}

export async function listProtonNotes(): Promise<RemoteEncryptedNote[]> {
  if (!_creds) return []

  const resp = await fetch(`${DIR}/`, {
    method: 'PROPFIND',
    headers: {
      Authorization: authHeader(_creds),
      Depth: '1',
      'Content-Type': 'application/xml; charset=utf-8',
    },
    body: '<?xml version="1.0" encoding="utf-8"?><propfind xmlns="DAV:"><prop><resourcetype/><getlastmodified/></prop></propfind>',
  })

  if (!resp.ok && resp.status !== 207) return []

  const xml = await resp.text()
  const dom = new DOMParser().parseFromString(xml, 'application/xml')

  // Collect all href values that look like note files.
  const hrefEls = Array.from(dom.getElementsByTagNameNS('DAV:', 'href'))
  const noteHrefs = hrefEls
    .map((el) => el.textContent ?? '')
    .filter((href) => {
      const name = href.split('/').pop() ?? ''
      return name.startsWith(FILE_PREFIX) && name.endsWith('.json')
    })

  const notes: RemoteEncryptedNote[] = []
  const creds = _creds

  await Promise.allSettled(
    noteHrefs.map(async (href) => {
      try {
        const url = toProxyPath(href)
        const getResp = await fetch(url, {
          headers: { Authorization: authHeader(creds) },
        })
        if (!getResp.ok) return
        const note = (await getResp.json()) as RemoteEncryptedNote
        notes.push({ ...note, fileId: url })
      } catch {
        // Skip malformed entries.
      }
    }),
  )

  return notes
}

export async function upsertProtonNote(note: RemoteEncryptedNote): Promise<string> {
  if (!_creds) throw new Error('Proton Drive not connected')
  const path = `${DIR}/${FILE_PREFIX}${note.noteId}.json`
  const resp = await fetch(path, {
    method: 'PUT',
    headers: {
      Authorization: authHeader(_creds),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(note, null, 2),
  })
  if (!resp.ok && resp.status !== 201 && resp.status !== 204) {
    throw new Error(`PUT failed: ${resp.status}`)
  }
  return path
}
