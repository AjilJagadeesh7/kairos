export type SyncStatus = 'idle' | 'syncing' | 'ok' | 'error'
export type SyncProviderType = 'none' | 'localFolder' | 'googleDrive' | 's3' | 'webdav' | 'protonDrive'
export type StorageTarget = 'indexdb' | 'local'

export type SyncMeta = {
  noteId: string
  lastSynced: string
  remoteId?: string     // canonical provider-agnostic file/path identifier
  driveFileId?: string  // legacy — kept for backward compatibility
  localFolderPath?: string
  s3Key?: string
  webdavHref?: string
}
