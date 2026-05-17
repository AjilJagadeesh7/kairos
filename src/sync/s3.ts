/**
 * S3-compatible sync provider — plain .md files, no encryption.
 * Works with Cloudflare R2, AWS S3, MinIO, Backblaze B2, Wasabi, etc.
 * Uses AWS Signature V4 built entirely from the Web Crypto API — no SDK required.
 */
import { serializeNote, deserializeNote, noteIdToPath } from '../adapters/storage/noteSerializer'
import type { Note } from '../types'

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

const KEY_PREFIX = 'mindvault/notes/'

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

async function buildAuthHeaders(
  method: string, url: URL, bodyStr: string, cfg: S3Config,
  extraSignedHeaders: Record<string, string> = {},
): Promise<Record<string, string>> {
  const now       = new Date()
  const amzDate   = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z'
  const dateStamp = amzDate.slice(0, 8)
  const bodyHash  = await sha256Hex(bodyStr)

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
// Low-level fetch
// ---------------------------------------------------------------------------

async function s3Fetch(method: string, url: URL, body: string | null, cfg: S3Config,
  extraSignedHeaders: Record<string, string> = {}): Promise<Response> {
  const authHeaders = await buildAuthHeaders(method, url, body ?? '', cfg, extraSignedHeaders)
  const res = await fetch(url.toString(), { method, headers: authHeaders, body: body ?? undefined })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`S3 ${method} ${url.pathname} → ${res.status}: ${text.slice(0, 300)}`)
  }
  return res
}

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

function objectUrl(cfg: S3Config, key: string): URL {
  return new URL(`${cfg.endpoint.replace(/\/$/, '')}/${cfg.bucket}/${key}`)
}

function listUrl(cfg: S3Config, maxKeys?: number): URL {
  const url = new URL(`${cfg.endpoint.replace(/\/$/, '')}/${cfg.bucket}`)
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
  const res     = await fetch(url.toString(), { method: 'DELETE', headers })
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => '')
    throw new Error(`S3 DELETE ${url.pathname} → ${res.status}: ${text.slice(0, 200)}`)
  }
}

/** Verify credentials and bucket access. Throws a descriptive error on failure. */
export async function testS3Connection(cfg: S3Config): Promise<void> {
  const url = listUrl(cfg, 1)
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: await buildAuthHeaders('GET', url, '', cfg),
  })
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
