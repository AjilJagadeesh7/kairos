export type Note = {
  id: string
  title: string
  content: string
  tags: string[]
  createdAt: string
  updatedAt: string
  embedding?: number[]  // deprecated field - embeddings now live in db.embeddings table
}

export type SettingRecord = {
  key: string
  value: string
}

export type FileHandleRecord = {
  key: string
  handle: unknown // FileSystemDirectoryHandle — stored natively in IndexedDB
}

export type SyncMeta = {
  noteId: string
  lastSynced: string
  remoteId?: string     // canonical provider-agnostic file/path identifier
  driveFileId?: string  // legacy — kept for backward compatibility
}

export type SyncStatus = 'idle' | 'syncing' | 'ok' | 'error'

export type SyncProviderType = 'none' | 'localFolder' | 'googleDrive' | 's3' | 'webdav' | 'protonDrive'

export type SearchMode = 'fulltext' | 'semantic'

export type ThemeMode = 'light' | 'dark' | 'cyberpunk'

export type EdgeKind = 'wikilink' | 'semantic'

export type GraphEdge = {
  id: string
  source: string
  target: string
  kind: EdgeKind
  weight?: number
}
