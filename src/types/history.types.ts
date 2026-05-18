export type ContentVersion = {
  savedAt: string    // ISO timestamp
  title?: string     // notes have a title; journal entries don't
  content: string
}

export type VersionHistory = {
  versions: ContentVersion[]   // ordered oldest → newest; capped at MAX_VERSIONS
}
