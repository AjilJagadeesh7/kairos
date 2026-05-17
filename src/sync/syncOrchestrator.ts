import { isLocalFolderConnected, listLocalNotes, upsertLocalNote, deleteLocalNote } from './localFolder'
import { isS3Connected, listS3Notes, upsertS3Note, deleteS3Note } from './s3'
import { isWebDAVConnected, listWebDAVNotes, upsertWebDAVNote, deleteWebDAVNote } from './webdav'
import { db } from '../db/schema'
import type { Note, SyncStatus } from '../types'

// ---------------------------------------------------------------------------
// Single-note push — called after every save
// ---------------------------------------------------------------------------

export async function pushNoteToAll(note: Note): Promise<void> {
  const tasks: Array<[string, Promise<string>]> = []

  if (isLocalFolderConnected()) tasks.push(['localFolder', upsertLocalNote(note)])
  if (isS3Connected())          tasks.push(['s3',          upsertS3Note(note)])
  if (isWebDAVConnected())      tasks.push(['webdav',      upsertWebDAVNote(note)])

  if (tasks.length === 0) return

  const results = await Promise.allSettled(tasks.map(([, p]) => p))

  if (results.some((r) => r.status === 'fulfilled')) {
    await db.syncMeta.put({ noteId: note.id, lastSynced: new Date().toISOString() })
  }

  results.forEach((r, i) => {
    if (r.status === 'rejected') console.warn(`[sync] ${tasks[i][0]} push failed:`, r.reason)
  })
}

// ---------------------------------------------------------------------------
// Full two-way sync — on startup and from Settings "Sync Now"
// ---------------------------------------------------------------------------

export async function syncAllProviders(onStatus: (s: SyncStatus) => void): Promise<void> {
  onStatus('syncing')
  try {
    const { readAllNotes, writePlainNote, isPlainFolderConnected } = await import('./plainFolder')

    const [localRemotes, s3Remotes, davRemotes] = await Promise.all([
      isLocalFolderConnected() ? listLocalNotes()    : Promise.resolve([]),
      isS3Connected()          ? listS3Notes()       : Promise.resolve([]),
      isWebDAVConnected()      ? listWebDAVNotes()   : Promise.resolve([]),
    ])

    // Merge all remotes: last-write-wins by updatedAt
    const remoteMap = new Map<string, Note>()
    for (const notes of [localRemotes, s3Remotes, davRemotes]) {
      for (const note of notes) {
        const existing = remoteMap.get(note.id)
        if (!existing || new Date(note.updatedAt) > new Date(existing.updatedAt)) {
          remoteMap.set(note.id, note)
        }
      }
    }

    // Load local notes from filesystem
    const localList = isPlainFolderConnected() ? await readAllNotes() : []
    const localMap  = new Map(localList.map((n) => [n.id, n]))

    // Pull: remote notes that are newer than local → write to filesystem
    for (const remote of remoteMap.values()) {
      const local    = localMap.get(remote.id)
      const remoteTs = new Date(remote.updatedAt).getTime()
      const localTs  = local ? new Date(local.updatedAt).getTime() : -1

      if (!local || remoteTs > localTs) {
        if (isPlainFolderConnected()) {
          await writePlainNote({ ...remote, embedding: local?.embedding ?? [] })
        }
        await db.syncMeta.put({ noteId: remote.id, lastSynced: new Date().toISOString() })
      }
    }

    // Push: all local notes → all providers
    const freshNotes = isPlainFolderConnected() ? await readAllNotes() : []
    await Promise.allSettled(freshNotes.map((n) => pushNoteToAll(n)))

    onStatus('ok')
  } catch (err) {
    console.error('[sync] syncAllProviders failed:', err)
    onStatus('error')
  }
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteNoteFromAll(noteId: string): Promise<void> {
  const tasks: Array<[string, Promise<void>]> = []

  if (isLocalFolderConnected()) tasks.push(['localFolder', deleteLocalNote(noteId)])
  if (isS3Connected())          tasks.push(['s3',          deleteS3Note(noteId)])
  if (isWebDAVConnected())      tasks.push(['webdav',      deleteWebDAVNote(noteId)])

  const results = await Promise.allSettled(tasks.map(([, p]) => p))
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.warn(`[sync] ${tasks[i][0]} delete failed:`, r.reason)
  })
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export function anySyncProviderConnected(): boolean {
  return isLocalFolderConnected() || isS3Connected() || isWebDAVConnected()
}
