/**
 * Low-level S3 transport.
 *
 * SigV4 requests carry "non-simple" headers (Authorization, x-amz-*), so a
 * plain browser fetch fires a CORS preflight the bucket answers with 403 →
 * the request never runs. We bypass the WebView network stack exactly like
 * WebDAV does:
 *   - Desktop (Tauri): rewrite https:// → mvproxy:// so the Rust scheme handler
 *     performs the request server-side (it answers preflight locally, forwards
 *     every header/verb/body, and sets Host from the URL — which still matches
 *     the signed host header).
 *   - Mobile (Capacitor): native HTTP bridge, not subject to CORS.
 *   - Web: plain fetch (works only if the bucket sends CORS headers).
 */
import { isDesktop, isMobile } from '../utils/platform'
import { buildAuthHeaders } from './s3Signature'
import type { S3Config } from '../types'

export interface S3Result {
  status: number
  ok: boolean
  text: () => Promise<string>
}

function proxied(url: URL): string {
  return isDesktop() ? url.toString().replace(/^https?:\/\//, 'mvproxy://') : url.toString()
}

export async function s3Send(method: string, url: URL, body: string | null, headers: Record<string, string>): Promise<S3Result> {
  if (isMobile()) {
    const { CapacitorHttp } = await import('@capacitor/core')
    const res = await CapacitorHttp.request({
      url: url.toString(), method, headers, data: body ?? undefined, responseType: 'text',
    })
    const text = typeof res.data === 'string' ? res.data : (res.data == null ? '' : String(res.data))
    return { status: res.status, ok: res.status >= 200 && res.status < 300, text: () => Promise.resolve(text) }
  }

  const res = await fetch(proxied(url), { method, headers, body: body ?? undefined })
  return { status: res.status, ok: res.ok, text: () => res.text() }
}

/** Sign, send, and throw on any non-2xx — the workhorse for text requests. */
export async function s3Fetch(method: string, url: URL, body: string | null, cfg: S3Config,
  extraSignedHeaders: Record<string, string> = {}): Promise<S3Result> {
  const authHeaders = await buildAuthHeaders(method, url, body ?? '', cfg, extraSignedHeaders)
  const res = await s3Send(method, url, body, authHeaders)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`S3 ${method} ${url.pathname} → ${res.status}: ${text.slice(0, 300)}`)
  }
  return res
}

export async function s3SendBinary(method: string, url: URL, body: Uint8Array | null, headers: Record<string, string>): Promise<{ ok: boolean; status: number; bytes: Uint8Array | null }> {
  if (isMobile()) {
    if (method === 'GET') {
      const { CapacitorHttp } = await import('@capacitor/core')
      const res = await CapacitorHttp.request({ url: url.toString(), method, headers, responseType: 'arraybuffer' })
      const ok = res.status >= 200 && res.status < 300
      return { ok, status: res.status, bytes: ok && typeof res.data === 'string' ? base64ToBytes(res.data) : null }
    }
    throw new Error('S3 binary upload not supported on mobile')
  }
  const res = await fetch(proxied(url), { method, headers, body: body as BodyInit | undefined })
  return { ok: res.ok, status: res.status, bytes: res.ok && method === 'GET' ? new Uint8Array(await res.arrayBuffer()) : null }
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
