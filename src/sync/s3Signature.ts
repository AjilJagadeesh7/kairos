/**
 * AWS Signature V4, built entirely from the Web Crypto API — no SDK required.
 * Shared by every S3 request in `s3.ts` / `s3Transport.ts`.
 */
import type { S3Config } from '../types'

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
  const k2 = await hmac(k1, region)
  const k3 = await hmac(k2, 's3')
  return hmac(k3, 'aws4_request')
}

/** SHA-256 of raw bytes, hex encoded — the payload hash for binary uploads. */
export async function sha256HexBytes(bytes: Uint8Array): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', bytes as BufferSource))
}

export async function buildAuthHeaders(
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
