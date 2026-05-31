export type SyncStatus = 'idle' | 'syncing' | 'ok' | 'error'
export type SyncProviderType = 'none' | 'localFolder' | 'googleDrive' | 's3' | 'webdav' | 'protonDrive'
export type StorageTarget = 'indexdb' | 'local'

/** Content/config buckets the user can independently choose to sync. */
export type SyncCategory = 'notes' | 'journal' | 'kanban' | 'canvas' | 'settings' | 'secrets'

/** Per-category direction toggles: push = local→cloud, pull = cloud→local. */
export type SyncDirection = { push: boolean; pull: boolean }
export type SyncScope = Record<SyncCategory, SyncDirection>

export const SYNC_CATEGORIES: SyncCategory[] = ['notes', 'journal', 'kanban', 'canvas', 'settings', 'secrets']

/**
 * Default scope for a freshly connected remote: sync everything except secrets.
 * Secrets (provider credentials) stay device-local until the user opts in.
 */
export const DEFAULT_SYNC_SCOPE: SyncScope = {
  notes:    { push: true,  pull: true },
  journal:  { push: true,  pull: true },
  kanban:   { push: true,  pull: true },
  canvas:   { push: true,  pull: true },
  settings: { push: true,  pull: true },
  secrets:  { push: false, pull: false },
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
