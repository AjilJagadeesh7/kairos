export type SyncStatus = 'idle' | 'syncing' | 'ok' | 'error'
export type SyncProviderType = 'none' | 'localFolder' | 'googleDrive' | 's3' | 'webdav' | 'protonDrive'
export type StorageTarget = 'indexdb' | 'local'

// ---------------------------------------------------------------------------
// Sync providers
// ---------------------------------------------------------------------------

/**
 * Canonical id for every sync backend. Use this everywhere a provider is
 * referenced — never bare string literals.
 *   - `local`  : a second local folder on disk (desktop only)
 *   - `s3`     : any S3-compatible object store (AWS S3, Backblaze B2, R2, …)
 *   - `webdav` : WebDAV server (Nextcloud, ownCloud, Koofr, …)
 *   - `kairos` : managed Kairos Sync service (coming soon)
 */
export const SYNC_PROVIDERS = ['local', 's3', 'webdav', 'kairos'] as const
export type SyncProviderId = (typeof SYNC_PROVIDERS)[number]

export interface SyncProviderMeta {
  id: SyncProviderId
  /** Full human label, e.g. "S3 / Backblaze B2". */
  label: string
  /** Compact label for column headers, e.g. "S3 / B2". */
  short: string
  /** Reserved but not yet available to connect. */
  comingSoon?: boolean
}

export const SYNC_PROVIDER_META: Record<SyncProviderId, SyncProviderMeta> = {
  local:  { id: 'local',  label: 'Local folder',         short: 'Local'  },
  s3:     { id: 's3',     label: 'S3 / Backblaze B2',    short: 'S3 / B2' },
  webdav: { id: 'webdav', label: 'WebDAV',               short: 'WebDAV' },
  kairos: { id: 'kairos', label: 'Kairos Sync',          short: 'Kairos', comingSoon: true },
}

// ---------------------------------------------------------------------------
// Sync rules — what syncs, where, in which direction
// ---------------------------------------------------------------------------

/** Content/config buckets the user can independently choose to sync. */
export type SyncCategory = 'notes' | 'journal' | 'kanban' | 'canvas' | 'settings' | 'secrets'

export const SYNC_CATEGORIES: SyncCategory[] = ['notes', 'journal', 'kanban', 'canvas', 'settings', 'secrets']

/** Direction toggles for one (category, provider) pair. */
export type SyncDirection = { push: boolean; pull: boolean }

/**
 * The full sync matrix: for every category, the push/pull rule against every
 * provider. `rules[category][provider]` answers "does <category> sync to/from
 * <provider>?" — letting the user route each feature independently
 * (e.g. notes → all, kanban → WebDAV only, settings → Kairos).
 */
export type SyncRules = Record<SyncCategory, Record<SyncProviderId, SyncDirection>>

const everyProvider = (push: boolean, pull: boolean): Record<SyncProviderId, SyncDirection> => ({
  local:  { push, pull },
  s3:     { push, pull },
  webdav: { push, pull },
  kairos: { push, pull },
})

/**
 * Default matrix: sync every category to every provider, except secrets
 * (provider credentials) which stay device-local until explicitly opted in.
 */
export const DEFAULT_SYNC_RULES: SyncRules = {
  notes:    everyProvider(true,  true),
  journal:  everyProvider(true,  true),
  kanban:   everyProvider(true,  true),
  canvas:   everyProvider(true,  true),
  settings: everyProvider(true,  true),
  secrets:  everyProvider(false, false),
}

export type SyncMeta = {
  noteId: string
  lastSynced: string
  remoteId?: string     // canonical provider-agnostic file/path identifier
  driveFileId?: string  // legacy — kept for backward compatibility
  localFolderPath?: string
  s3Key?: string
  webdavHref?: string
}
