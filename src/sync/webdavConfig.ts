/** The connected WebDAV server, held in module state so every WebDAV module
 *  (notes, blobs, binaries) reads the same credentials. */
import type { WebDAVConfig } from '../types'

let _config: WebDAVConfig | null = null

export function setWebDAVConfig(cfg: WebDAVConfig | null): void { _config = cfg }
export function getWebDAVConfig(): WebDAVConfig | null           { return _config }

export function isWebDAVConnected(): boolean {
  return _config !== null && Boolean(_config.url && _config.username && _config.password)
}

/** The config, or a thrown error — for calls that can't proceed without one. */
export function requireWebDAVConfig(): WebDAVConfig {
  if (!_config) throw new Error('WebDAV not configured')
  return _config
}

/** The configured directory URL with any trailing slash removed. */
export function rootUrl(cfg: WebDAVConfig): string {
  return cfg.url.replace(/\/$/, '')
}
