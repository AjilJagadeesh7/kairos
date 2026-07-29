/**
 * S3-compatible sync provider — plain .md files, no encryption.
 * Works with Cloudflare R2, AWS S3, MinIO, Backblaze B2, Wasabi, etc.
 * Request signing lives in `s3Signature.ts`, transport in `s3Transport.ts`.
 */
import { serializeNote, deserializeNote, noteIdToPath } from '../adapters/storage/noteSerializer'
import { buildAuthHeaders, sha256HexBytes } from './s3Signature'
import { s3Send, s3Fetch, s3SendBinary } from './s3Transport'
import type { Note, S3Config, SyncCategory } from '../types'
import type { RemoteBlob, RemoteProvider } from './remoteProvider'

export type { S3Config }

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

let _config: S3Config | null = null

export function setS3Config(cfg: S3Config | null): void  { _config = cfg }
export function getS3Config(): S3Config | null            { return _config }

export function isS3Connected(): boolean {
  return _config !== null
    && Boolean(_config.endpoint && _config.bucket && _config.accessKey && _config.secretKey)
}

const ROOT_PREFIX = 'kairos/'
const KEY_PREFIX = `${ROOT_PREFIX}notes/`

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

/** Normalize the endpoint: strip whitespace, default to https://, drop trailing slash. */
function endpointBase(cfg: S3Config): string {
  let ep = (cfg.endpoint ?? '').replace(/\s+/g, '')
  if (!ep) throw new Error('S3 endpoint is empty')
  if (!/^https?:\/\//i.test(ep)) ep = `https://${ep}`
  return ep.replace(/\/+$/, '')
}

function bucketName(cfg: S3Config): string {
  return (cfg.bucket ?? '').replace(/\s+/g, '').replace(/^\/+|\/+$/g, '')
}

function objectUrl(cfg: S3Config, key: string): URL {
  return new URL(`${endpointBase(cfg)}/${bucketName(cfg)}/${key}`)
}

function listUrl(cfg: S3Config, maxKeys?: number): URL {
  const url = new URL(`${endpointBase(cfg)}/${bucketName(cfg)}`)
  url.searchParams.set('list-type', '2')
  url.searchParams.set('prefix', KEY_PREFIX)
  if (maxKeys !== undefined) url.searchParams.set('max-keys', String(maxKeys))
  return url
}

function parseListXml(xml: string): string[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  return Array.from(doc.querySelectorAll('Contents'))
    .map((el) => el.querySelector('Key')?.textContent ?? '')
    .filter((k) => k.endsWith('.md'))
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function listS3Notes(): Promise<Note[]> {
  const cfg = _config
  if (!cfg) throw new Error('S3 not configured')

  const res  = await s3Fetch('GET', listUrl(cfg), null, cfg)
  const keys = parseListXml(await res.text())

  const notes: Note[] = []
  for (const key of keys) {
    try {
      const getRes = await s3Fetch('GET', objectUrl(cfg, key), null, cfg)
      const note   = deserializeNote(await getRes.text())
      notes.push({ ...note, embedding: note.embedding ?? [] })
    } catch (err) {
      console.warn('S3: skipping', key, err)
    }
  }
  return notes
}

export async function upsertS3Note(note: Note): Promise<string> {
  const cfg = _config
  if (!cfg) throw new Error('S3 not configured')

  const key  = `${KEY_PREFIX}${noteIdToPath(note.id)}`
  await s3Fetch('PUT', objectUrl(cfg, key), serializeNote(note), cfg, { 'content-type': 'text/markdown; charset=utf-8' })
  return key
}

export async function deleteS3Note(noteId: string): Promise<void> {
  const cfg = _config
  if (!cfg) throw new Error('S3 not configured')
  const url     = objectUrl(cfg, `${KEY_PREFIX}${noteIdToPath(noteId)}`)
  const headers = await buildAuthHeaders('DELETE', url, '', cfg)
  const res     = await s3Send('DELETE', url, null, headers)
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => '')
    throw new Error(`S3 DELETE ${url.pathname} → ${res.status}: ${text.slice(0, 200)}`)
  }
}

// ---------------------------------------------------------------------------
// Generic blob API — keyed by category subfolder (kairos/{category}/{file})
// ---------------------------------------------------------------------------

function contentTypeFor(filename: string): string {
  return filename.endsWith('.json')
    ? 'application/json; charset=utf-8'
    : 'text/markdown; charset=utf-8'
}

function categoryPrefix(category: SyncCategory): string {
  return `${ROOT_PREFIX}${category}/`
}

function parseAllKeys(xml: string, prefix: string): string[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  return Array.from(doc.querySelectorAll('Contents'))
    .map((el) => el.querySelector('Key')?.textContent ?? '')
    .filter((k) => k.length > prefix.length && !k.endsWith('/'))
}

export async function putS3Blob(category: SyncCategory, filename: string, content: string): Promise<void> {
  const cfg = _config
  if (!cfg) throw new Error('S3 not configured')
  await s3Fetch('PUT', objectUrl(cfg, `${categoryPrefix(category)}${filename}`), content, cfg, { 'content-type': contentTypeFor(filename) })
}

export async function listS3Blob(category: SyncCategory): Promise<RemoteBlob[]> {
  const cfg = _config
  if (!cfg) throw new Error('S3 not configured')
  const prefix = categoryPrefix(category)
  const url = new URL(`${endpointBase(cfg)}/${bucketName(cfg)}`)
  url.searchParams.set('list-type', '2')
  url.searchParams.set('prefix', prefix)

  const res  = await s3Fetch('GET', url, null, cfg)
  const keys = parseAllKeys(await res.text(), prefix)

  const blobs: RemoteBlob[] = []
  for (const key of keys) {
    try {
      const getRes = await s3Fetch('GET', objectUrl(cfg, key), null, cfg)
      blobs.push({ name: key.slice(prefix.length), content: await getRes.text() })
    } catch (err) {
      console.warn('S3: skipping', key, err)
    }
  }
  return blobs
}

export async function deleteS3Blob(category: SyncCategory, filename: string): Promise<void> {
  const cfg = _config
  if (!cfg) throw new Error('S3 not configured')
  const url     = objectUrl(cfg, `${categoryPrefix(category)}${filename}`)
  const headers = await buildAuthHeaders('DELETE', url, '', cfg)
  const res     = await s3Send('DELETE', url, null, headers)
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => '')
    throw new Error(`S3 DELETE ${url.pathname} → ${res.status}: ${text.slice(0, 200)}`)
  }
}

// ---------------------------------------------------------------------------
// Binary objects — media attachments at kairos/<relPath>
// ---------------------------------------------------------------------------

export async function putS3Binary(relPath: string, bytes: Uint8Array): Promise<void> {
  const cfg = _config
  if (!cfg) throw new Error('S3 not configured')
  const url     = objectUrl(cfg, `${ROOT_PREFIX}${relPath}`)
  const hash    = await sha256HexBytes(bytes)
  const headers = await buildAuthHeaders('PUT', url, '', cfg, { 'content-type': 'application/octet-stream' }, hash)
  const res     = await s3SendBinary('PUT', url, bytes, headers)
  if (!res.ok) throw new Error(`S3 PUT binary ${url.pathname} → ${res.status}`)
}

export async function getS3Binary(relPath: string): Promise<Uint8Array | null> {
  const cfg = _config
  if (!cfg) return null
  const url     = objectUrl(cfg, `${ROOT_PREFIX}${relPath}`)
  const headers = await buildAuthHeaders('GET', url, '', cfg)
  const res     = await s3SendBinary('GET', url, null, headers).catch(() => null)
  return res?.ok ? res.bytes : null
}

export async function listS3Binary(prefix: string): Promise<string[]> {
  const cfg = _config
  if (!cfg) return []
  const fullPrefix = `${ROOT_PREFIX}${prefix.replace(/\/$/, '')}/`
  const url = new URL(`${endpointBase(cfg)}/${bucketName(cfg)}`)
  url.searchParams.set('list-type', '2')
  url.searchParams.set('prefix', fullPrefix)
  const res  = await s3Fetch('GET', url, null, cfg).catch(() => null)
  if (!res) return []
  return parseAllKeys(await res.text(), fullPrefix).map((k) => k.slice(ROOT_PREFIX.length))
}

export async function deleteS3Binary(relPath: string): Promise<void> {
  const cfg = _config
  if (!cfg) return
  const url     = objectUrl(cfg, `${ROOT_PREFIX}${relPath}`)
  const headers = await buildAuthHeaders('DELETE', url, '', cfg)
  const res     = await s3Send('DELETE', url, null, headers)
  if (!res.ok && res.status !== 404) throw new Error(`S3 DELETE binary ${url.pathname} → ${res.status}`)
}

export const s3Provider: RemoteProvider = {
  id: 's3',
  isConnected: isS3Connected,
  putBlob: putS3Blob,
  listBlob: listS3Blob,
  deleteBlob: deleteS3Blob,
  putBinary: putS3Binary,
  getBinary: getS3Binary,
  listBinary: listS3Binary,
  deleteBinary: deleteS3Binary,
}

/** Verify credentials and bucket access. Throws a descriptive error on failure. */
export async function testS3Connection(cfg: S3Config): Promise<void> {
  const url = listUrl(cfg, 1)
  const res = await s3Send('GET', url, null, await buildAuthHeaders('GET', url, '', cfg))
  if (res.status === 403) throw new Error('Access denied — check your access key and secret')
  if (res.status === 404) throw new Error('Bucket not found — check bucket name and endpoint')
  if (!res.ok)            throw new Error(`S3 error ${res.status}`)
}

/** Quick reachability check using the stored config. Returns error message or null. */
export async function pingS3(): Promise<string | null> {
  if (!_config) return null
  try {
    await testS3Connection(_config)
    return null
  } catch (err) {
    return err instanceof Error ? err.message : 'S3 unreachable'
  }
}
