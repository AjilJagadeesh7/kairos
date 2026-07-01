/**
 * S3-compatible sync provider — plain .md files, no encryption.
 * Works with Cloudflare R2, AWS S3, MinIO, Backblaze B2, Wasabi, etc.
 * Uses AWS Signature V4 built entirely from the Web Crypto API — no SDK required.
 */
import { serializeNote, deserializeNote, noteIdToPath } from '../adapters/storage/noteSerializer'
import { isDesktop, isMobile } from '../utils/platform'
import type { Note, SyncCategory } from '../types'
import type { RemoteBlob, RemoteProvider } from './remoteProvider'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export type S3Config = {
  /** Base endpoint URL, no trailing slash. e.g. https://xxxx.r2.cloudflarestorage.com */
  endpoint: string
  bucket: string
  accessKey: string
  secretKey: string
  /** "auto" for R2, "us-east-1" for AWS, etc. */
  region: string
}

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
// AWS Signature V4 — pure Web Crypto
// ---------------------------------------------------------------------------

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function sha256Hex(data: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data)))
}

async function hmac(keyBuf: BufferSource, data: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', keyBuf, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
}

async function deriveSigKey(secretKey: string, dateStamp: string, region: string): Promise<ArrayBuffer> {
  const k1 = await hmac(new TextEncoder().encode('AWS4' + secretKey), dateStamp)
  const k2  = await hmac(k1, region)
  const k3  = await hmac(k2, 's3')
  return hmac(k3, 'aws4_request')
}

async function sha256HexBytes(bytes: Uint8Array): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', bytes as BufferSource))
}

async function buildAuthHeaders(
  method: string, url: URL, bodyStr: string, cfg: S3Config,
  extraSignedHeaders: Record<string, string> = {},
  bodyHashOverride?: string,
): Promise<Record<string, string>> {
  const now       = new Date()
  const amzDate   = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z'
  const dateStamp = amzDate.slice(0, 8)
  const bodyHash  = bodyHashOverride ?? await sha256Hex(bodyStr)

  const headers: Record<string, string> = {
    host: url.host, 'x-amz-content-sha256': bodyHash, 'x-amz-date': amzDate, ...extraSignedHeaders,
  }

  const sortedKeys       = Object.keys(headers).sort()
  const signedHeadersStr = sortedKeys.join(';')
  const canonicalHeaders = sortedKeys.map((k) => `${k}:${headers[k]}\n`).join('')
  const canonicalQueryStr = [...url.searchParams.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')

  const canonicalRequest = [method, url.pathname, canonicalQueryStr, canonicalHeaders, signedHeadersStr, bodyHash].join('\n')
  const credScope        = `${dateStamp}/${cfg.region}/s3/aws4_request`
  const stringToSign     = `AWS4-HMAC-SHA256\n${amzDate}\n${credScope}\n${await sha256Hex(canonicalRequest)}`
  const sigBuf           = await hmac(await deriveSigKey(cfg.secretKey, dateStamp, cfg.region), stringToSign)

  return {
    ...headers,
    Authorization: `AWS4-HMAC-SHA256 Credential=${cfg.accessKey}/${credScope}, SignedHeaders=${signedHeadersStr}, Signature=${toHex(sigBuf)}`,
  }
}

// ---------------------------------------------------------------------------
// Low-level transport
//
// SigV4 requests carry "non-simple" headers (Authorization, x-amz-*), so a
// plain browser fetch fires a CORS preflight the bucket answers with 403 →
// the request never runs. We bypass the WebView network stack exactly like
// WebDAV does:
//   - Desktop (Tauri): rewrite https:// → mvproxy:// so the Rust scheme handler
//     performs the request server-side (it answers preflight locally, forwards
//     every header/verb/body, and sets Host from the URL — which still matches
//     the signed host header).
//   - Mobile (Capacitor): native HTTP bridge, not subject to CORS.
//   - Web: plain fetch (works only if the bucket sends CORS headers).
// ---------------------------------------------------------------------------

interface S3Result {
  status: number
  ok: boolean
  text: () => Promise<string>
}

async function s3Send(method: string, url: URL, body: string | null, headers: Record<string, string>): Promise<S3Result> {
  if (isMobile()) {
    const { CapacitorHttp } = await import('@capacitor/core')
    const res = await CapacitorHttp.request({
      url: url.toString(), method, headers, data: body ?? undefined, responseType: 'text',
    })
    const text = typeof res.data === 'string' ? res.data : (res.data == null ? '' : String(res.data))
    return { status: res.status, ok: res.status >= 200 && res.status < 300, text: () => Promise.resolve(text) }
  }

  const target = isDesktop() ? url.toString().replace(/^https?:\/\//, 'mvproxy://') : url.toString()
  const res = await fetch(target, { method, headers, body: body ?? undefined })
  return { status: res.status, ok: res.ok, text: () => res.text() }
}

async function s3Fetch(method: string, url: URL, body: string | null, cfg: S3Config,
  extraSignedHeaders: Record<string, string> = {}): Promise<S3Result> {
  const authHeaders = await buildAuthHeaders(method, url, body ?? '', cfg, extraSignedHeaders)
  const res = await s3Send(method, url, body, authHeaders)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`S3 ${method} ${url.pathname} → ${res.status}: ${text.slice(0, 300)}`)
  }
  return res
}

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

async function s3SendBinary(method: string, url: URL, body: Uint8Array | null, headers: Record<string, string>): Promise<{ ok: boolean; status: number; bytes: Uint8Array | null }> {
  if (isMobile()) {
    if (method === 'GET') {
      const { CapacitorHttp } = await import('@capacitor/core')
      const res = await CapacitorHttp.request({ url: url.toString(), method, headers, responseType: 'arraybuffer' })
      const ok = res.status >= 200 && res.status < 300
      return { ok, status: res.status, bytes: ok && typeof res.data === 'string' ? s3Base64ToBytes(res.data) : null }
    }
    throw new Error('S3 binary upload not supported on mobile')
  }
  const target = isDesktop() ? url.toString().replace(/^https?:\/\//, 'mvproxy://') : url.toString()
  const res = await fetch(target, { method, headers, body: body as BodyInit | undefined })
  return { ok: res.ok, status: res.status, bytes: res.ok && method === 'GET' ? new Uint8Array(await res.arrayBuffer()) : null }
}

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

function s3Base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
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
