/**
 * Provider-agnostic blob interface used by the sync orchestrator.
 *
 * Every remote provider (S3, WebDAV, a second local folder) exposes the same
 * three operations, keyed by a {@link SyncCategory} subfolder. The orchestrator
 * serializes each content type to a string and pushes/pulls it through here, so
 * it never needs provider-specific code.
 */
import type { SyncCategory, SyncProviderId } from '../types'
import { isS3Connected, s3Provider } from './s3'
import { isWebDAVConnected, webdavProvider } from './webdav'
import { isLocalFolderConnected, localFolderProvider } from './localFolder'

export interface RemoteBlob {
  /** Filename within the category folder, e.g. "2026-05-31.md" or "{id}.json". */
  name: string
  content: string
}

export interface RemoteProvider {
  id: SyncProviderId
  isConnected(): boolean
  putBlob(category: SyncCategory, filename: string, content: string): Promise<void>
  listBlob(category: SyncCategory): Promise<RemoteBlob[]>
  deleteBlob(category: SyncCategory, filename: string): Promise<void>

  // Binary objects (media attachments). `path` is provider-root-relative, e.g.
  // "attachments/<ownerId>/photo.png". Optional so a provider can opt out.
  putBinary?(path: string, bytes: Uint8Array): Promise<void>
  getBinary?(path: string): Promise<Uint8Array | null>
  /** Paths (relative to provider root) of every binary object under `prefix`. */
  listBinary?(prefix: string): Promise<string[]>
  deleteBinary?(path: string): Promise<void>
}

const ALL_PROVIDERS: RemoteProvider[] = [localFolderProvider, s3Provider, webdavProvider]

/** Remote providers the user currently has connected. */
export function connectedProviders(): RemoteProvider[] {
  return ALL_PROVIDERS.filter((p) => p.isConnected())
}

/** True when at least one remote provider is connected. */
export function anyRemoteConnected(): boolean {
  return isS3Connected() || isWebDAVConnected() || isLocalFolderConnected()
}
