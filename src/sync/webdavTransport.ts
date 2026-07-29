/**
 * WebDAV transport and XML helpers, shared by every WebDAV call.
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
import { isDesktop, isMobile } from '../utils/platform'

export interface DavResult {
  status: number
  ok: boolean
  text: () => Promise<string>
}

interface DavInit {
  method: string
  headers: Record<string, string>
  body?: string
}

export function basicAuth(username: string, password: string): string {
  return 'Basic ' + btoa(`${username}:${password}`)
}

export async function davFetch(url: string, init: DavInit): Promise<DavResult> {
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

/** Low-level binary request. Desktop rewrites to mvproxy; web uses fetch. */
export async function davBinary(method: string, url: string, authHeader: string, body?: Uint8Array): Promise<{ ok: boolean; status: number; bytes: Uint8Array | null }> {
  if (isMobile()) {
    // Mobile binary upload/download isn't supported through the native bridge;
    // the local vault keeps the file. Treated as a soft failure upstream.
    if (method === 'GET') {
      const { CapacitorHttp } = await import('@capacitor/core')
      const res = await CapacitorHttp.request({ url, method, headers: { Authorization: authHeader }, responseType: 'arraybuffer' })
      const ok = res.status >= 200 && res.status < 300
      const bytes = ok && typeof res.data === 'string' ? base64ToBytes(res.data) : null
      return { ok, status: res.status, bytes }
    }
    throw new Error('WebDAV binary upload not supported on mobile')
  }
  const target = isDesktop() ? url.replace(/^https?:\/\//, 'mvproxy://') : url
  const res = await fetch(target, { method, headers: { Authorization: authHeader }, body: body as BodyInit | undefined })
  const bytes = res.ok && method === 'GET' ? new Uint8Array(await res.arrayBuffer()) : null
  return { ok: res.ok, status: res.status, bytes }
}

export function originOf(url: string): string {
  const u = new URL(url)
  return `${u.protocol}//${u.host}`
}

export async function ensureDir(baseUrl: string, authHeader: string): Promise<void> {
  const url = baseUrl.replace(/\/?$/, '/')
  const res = await davFetch(url, { method: 'MKCOL', headers: { Authorization: authHeader } })
  if (!res.ok && res.status !== 405) throw new Error(`WebDAV: could not create directory (${res.status})`)
}

export const PROPFIND_NAMES = `<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:displayname/></d:prop></d:propfind>`
export const PROPFIND_TYPES = `<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>`

/** PROPFIND a collection and return every `<d:href>` it reports, unfiltered. */
export async function propfindHrefs(
  baseUrl: string, authHeader: string, depth: '0' | '1' | 'infinity', body: string,
): Promise<string[]> {
  const res = await davFetch(baseUrl + '/', {
    method: 'PROPFIND',
    headers: { Authorization: authHeader, Depth: depth, 'Content-Type': 'application/xml' },
    body,
  })
  if (!res.ok) {
    if (res.status === 401) throw new Error('WebDAV: invalid credentials')
    throw new Error(`WebDAV PROPFIND failed: ${res.status}`)
  }
  const doc = new DOMParser().parseFromString(await res.text(), 'text/xml')
  return Array.from(doc.getElementsByTagNameNS('DAV:', 'response'))
    .map((r) => r.getElementsByTagNameNS('DAV:', 'href')[0]?.textContent ?? '')
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
