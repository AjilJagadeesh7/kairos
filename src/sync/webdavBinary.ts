/** Binary (attachment) transfers for the WebDAV provider — files live at
 *  `{url}/<relPath>`, mirroring the vault layout. */
import { getWebDAVConfig, requireWebDAVConfig, rootUrl } from './webdavConfig'
import { basicAuth, davBinary, davFetch, ensureDir, originOf, propfindHrefs, PROPFIND_TYPES } from './webdavTransport'
import type { WebDAVConfig } from '../types'

async function ensureNestedDirs(cfg: WebDAVConfig, relPath: string, authHeader: string): Promise<void> {
  const segs = relPath.split('/').slice(0, -1) // drop the filename
  let acc = rootUrl(cfg)
  for (const seg of segs) {
    acc += `/${seg}`
    await ensureDir(acc, authHeader).catch(() => { /* may already exist */ })
  }
}

export async function putWebDAVBinary(relPath: string, bytes: Uint8Array): Promise<void> {
  const cfg = requireWebDAVConfig()
  const authHeader = basicAuth(cfg.username, cfg.password)
  await ensureNestedDirs(cfg, relPath, authHeader)
  const url = `${rootUrl(cfg)}/${relPath}`
  const res = await davBinary('PUT', url, authHeader, bytes)
  if (!res.ok && res.status !== 201 && res.status !== 204) throw new Error(`WebDAV PUT binary failed: ${res.status}`)
}

export async function getWebDAVBinary(relPath: string): Promise<Uint8Array | null> {
  const cfg = getWebDAVConfig()
  if (!cfg) return null
  const url = `${rootUrl(cfg)}/${relPath}`
  const res = await davBinary('GET', url, basicAuth(cfg.username, cfg.password)).catch(() => null)
  return res?.ok ? res.bytes : null
}

export async function listWebDAVBinary(prefix: string): Promise<string[]> {
  const cfg = getWebDAVConfig()
  if (!cfg) return []
  const authHeader = basicAuth(cfg.username, cfg.password)
  const baseUrl    = `${rootUrl(cfg)}/${prefix.replace(/\/$/, '')}`
  await ensureDir(baseUrl, authHeader).catch(() => {})

  const hrefs = await propfindHrefs(baseUrl, authHeader, 'infinity', PROPFIND_TYPES).catch(() => null)
  if (!hrefs) return []

  const origin   = originOf(baseUrl)
  const rootPath = new URL(baseUrl).pathname.replace(/\/$/, '')
  const base     = prefix.replace(/\/$/, '')

  return hrefs
    .filter((href) => !href.endsWith('/') && /\.[a-z0-9]+$/i.test(href))
    .map((href) => {
      const path = href.startsWith('http') ? new URL(href).pathname : (href.startsWith(origin) ? href.slice(origin.length) : href)
      const rel = decodeURIComponent(path.replace(rootPath, '').replace(/^\//, ''))
      return `${base}/${rel}`
    })
}

export async function deleteWebDAVBinary(relPath: string): Promise<void> {
  const cfg = getWebDAVConfig()
  if (!cfg) return
  const res = await davFetch(`${rootUrl(cfg)}/${relPath}`, {
    method: 'DELETE',
    headers: { Authorization: basicAuth(cfg.username, cfg.password) },
  }).catch(() => null)
  if (res && !res.ok && res.status !== 404) throw new Error(`WebDAV DELETE binary failed: ${res.status}`)
}
