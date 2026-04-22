import type { EncryptedPayload } from '../crypto/crypto'
import type { Note } from '../types'

export type SyncProviderType = 'none' | 'localFolder' | 'googleDrive' | 's3' | 'webdav' | 'protonDrive'

export type RemoteEncryptedNote = {
  noteId: string
  title: string
  tags: string[]
  createdAt: string
  updatedAt: string
  encrypted: EncryptedPayload
  /** Provider-specific identifier (Drive fileId, local filename, WebDAV path). */
  fileId?: string
}

export function toRemotePayload(note: Note, encrypted: EncryptedPayload): RemoteEncryptedNote {
  return {
    noteId: note.id,
    title: note.title,
    tags: note.tags,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    encrypted,
  }
}
