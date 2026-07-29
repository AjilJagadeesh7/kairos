/**
 * WebDAV sync provider — plain .md files, no encryption.
 * Works with Nextcloud, ownCloud, Koofr, pCloud, Box, any NAS.
 *
 * Transport lives in `webdavTransport.ts`, credentials in `webdavConfig.ts`
 * and attachment transfers in `webdavBinary.ts`.
 */
import { serializeNote, deserializeNote, noteIdToPath } from '../adapters/storage/noteSerializer'
import {
  getWebDAVConfig, setWebDAVConfig, isWebDAVConnected, requireWebDAVConfig, rootUrl,
} from './webdavConfig'
import {
  basicAuth, davFetch, ensureDir, originOf, propfindHrefs, PROPFIND_NAMES, PROPFIND_TYPES,
} from './webdavTransport'
import {
  putWebDAVBinary, getWebDAVBinary, listWebDAVBinary, deleteWebDAVBinary,
} from './webdavBinary'
import type { Note, SyncCategory, WebDAVConfig } from '../types'
import type { RemoteBlob, RemoteProvider } from './remoteProvider'

export type { WebDAVConfig }
export { getWebDAVConfig, setWebDAVConfig, isWebDAVConnected }
export { putWebDAVBinary, getWebDAVBinary, listWebDAVBinary, deleteWebDAVBinary }

// ---------------------------------------------------------------------------
// Notes — stored under a notes/ subpath inside the configured URL
// ---------------------------------------------------------------------------

function notesUrl(cfg: WebDAVConfig): string {
  return `${rootUrl(cfg)}/notes`
}

/** Fetch every href the caller kept, deserializing with `parse`. */
async function fetchEach<T>(hrefs: string[], origin: string, authHeader: string,
  parse: (body: string, href: string) => T): Promise<T[]> {
  const out: T[] = []
  for (const href of hrefs) {
    try {
      const fileUrl = href.startsWith('http') ? href : `${origin}${href}`
      const fileRes = await davFetch(fileUrl, { method: 'GET', headers: { Authorization: authHeader } })
      if (!fileRes.ok) continue
      out.push(parse(await fileRes.text(), href))
    } catch (err) {
      console.warn('WebDAV: skipping', href, err)
    }
  }
  return out
}

export async function listWebDAVNotes(): Promise<Note[]> {
  const cfg        = requireWebDAVConfig()
  const baseUrl    = notesUrl(cfg)
  const authHeader = basicAuth(cfg.username, cfg.password)

  await ensureDir(baseUrl, authHeader)

  const hrefs = (await propfindHrefs(baseUrl, authHeader, '1', PROPFIND_NAMES))
    .filter((href) => href.endsWith('.md'))

  return fetchEach(hrefs, originOf(baseUrl), authHeader, (body) => {
    const note = deserializeNote(body)
    return { ...note, embedding: note.embedding ?? [] }
  })
}

export async function upsertWebDAVNote(note: Note): Promise<string> {
  const cfg        = requireWebDAVConfig()
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
  const cfg     = requireWebDAVConfig()
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
  return `${rootUrl(cfg)}/${category}`
}

export async function putWebDAVBlob(category: SyncCategory, filename: string, content: string): Promise<void> {
  const cfg        = requireWebDAVConfig()
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
  const cfg        = requireWebDAVConfig()
  const baseUrl    = categoryUrl(cfg, category)
  const authHeader = basicAuth(cfg.username, cfg.password)

  await ensureDir(baseUrl, authHeader)

  // Files only (skip the collection itself — it has no filename extension)
  const hrefs = (await propfindHrefs(baseUrl, authHeader, '1', PROPFIND_NAMES))
    .filter((href) => !href.endsWith('/') && /\.[a-z0-9]+$/i.test(href))

  return fetchEach(hrefs, originOf(baseUrl), authHeader, (content, href) => ({
    name: decodeURIComponent(href.split('/').pop() ?? ''),
    content,
  }))
}

export async function deleteWebDAVBlob(category: SyncCategory, filename: string): Promise<void> {
  const cfg = requireWebDAVConfig()
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
  putBinary: putWebDAVBinary,
  getBinary: getWebDAVBinary,
  listBinary: listWebDAVBinary,
  deleteBinary: deleteWebDAVBinary,
}

// ---------------------------------------------------------------------------
// Connection checks
// ---------------------------------------------------------------------------

/** Verify the server URL and credentials. */
export async function testWebDAVConnection(cfg: WebDAVConfig): Promise<void> {
  const url = cfg.url.replace(/\/?$/, '/')
  const res = await davFetch(url, {
    method: 'PROPFIND',
    headers: {
      Authorization: basicAuth(cfg.username, cfg.password),
      Depth: '0', 'Content-Type': 'application/xml',
    },
    body: PROPFIND_TYPES,
  })
  if (res.status === 401) throw new Error('Invalid username or password')
  if (res.status === 403) throw new Error('Access denied — check permissions')
  if (res.status === 404) throw new Error('Directory not found — check your WebDAV URL')
  if (res.status !== 207 && !res.ok) throw new Error(`WebDAV server returned ${res.status}`)
}

/** Quick reachability check using stored config. Returns error message or null. */
export async function pingWebDAV(): Promise<string | null> {
  const cfg = getWebDAVConfig()
  if (!cfg) return null
  try {
    await testWebDAVConnection(cfg)
    return null
  } catch (err) {
    return err instanceof Error ? err.message : 'WebDAV unreachable'
  }
}
