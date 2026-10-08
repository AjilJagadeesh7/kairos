/**
 * Provider URL rules (PRD: HTTPS for every non-local base URL; plain HTTP only
 * for localhost and private LAN) and location derivation (localhost / private
 * LAN → self-hosted, everything else → cloud). Mirrored in Rust
 * (src-tauri/src/ai_http.rs) so the native layer enforces it too.
 */
import type { ProviderLocation } from '../../types'

function ipv4Parts(host: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (!m) return null
  const parts = m.slice(1).map(Number)
  return parts.every((n) => n <= 255) ? parts : null
}

function isPrivateIpv4([a, b]: number[]): boolean {
  return a === 127                              // loopback
    || a === 10                                 // 10/8
    || (a === 172 && b >= 16 && b <= 31)        // 172.16/12
    || (a === 192 && b === 168)                 // 192.168/16
    || (a === 169 && b === 254)                 // link-local
}

function isPrivateIpv6(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase()
  if (h === '::1') return true
  const first = parseInt(h.split(':')[0] || '0', 16)
  if (Number.isNaN(first)) return false
  return (first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80
}

/** localhost, *.local, loopback and private-network IPs. */
export function isLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true
  const v4 = ipv4Parts(host)
  if (v4) return isPrivateIpv4(v4)
  if (host.includes(':')) return isPrivateIpv6(host)
  return false
}

export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: string }

export function checkProviderUrl(raw: string): UrlCheck {
  let url: URL
  try { url = new URL(raw) } catch { return { ok: false, reason: 'Enter a full URL, e.g. http://localhost:11434/v1' } }
  if (url.protocol === 'https:') return { ok: true, url }
  if (url.protocol === 'http:') {
    return isLocalHost(url.hostname)
      ? { ok: true, url }
      : { ok: false, reason: 'Plain HTTP is only allowed for localhost and private-network addresses — use https://' }
  }
  return { ok: false, reason: `Unsupported URL scheme "${url.protocol}"` }
}

export function locationForUrl(raw: string): ProviderLocation {
  try {
    return isLocalHost(new URL(raw).hostname) ? 'self-hosted' : 'cloud'
  } catch {
    return 'cloud'
  }
}

/** Header label, e.g. "Self-hosted: Ollama" / "Cloud: OpenRouter". */
export function destinationLabel(location: ProviderLocation, name: string): string {
  if (location === 'on-device') return 'On-device'
  return `${location === 'self-hosted' ? 'Self-hosted' : 'Cloud'}: ${name}`
}
