import { serializeNote, deserializeNote, noteIdToPath } from '../adapters/storage/noteSerializer'
import { connectedProviders, anyRemoteConnected } from './remoteProvider'
import { canPush, canPull } from './syncScope'
import { CONTENT_ADAPTERS, type CategoryAdapter, type ContentCategory } from './categoryRegistry'
import { db } from '../db/schema'
import { useConflictStore } from '../store/useConflictStore'
import type { Note, SyncStatus, SyncCategory } from '../types'

// ---------------------------------------------------------------------------
// syncMeta keys: notes keep their bare id (backward compat); other categories
// are namespaced so ids never collide across content types.
// ---------------------------------------------------------------------------

function syncMetaKey(category: SyncCategory, id: string): string {
  return category === 'notes' ? id : `${category}:${id}`
}

// ---------------------------------------------------------------------------
// Notes — single-note push (immediate, called after every save)
// ---------------------------------------------------------------------------

export async function pushNoteToAll(note: Note): Promise<void> {
  const providers = connectedProviders()
  if (providers.length === 0) return
  const filename = noteIdToPath(note.id)

  // Opted out → make sure no stale cloud copy lingers.
  if (note.noSync) {
    await Promise.allSettled(providers.map((p) => p.deleteBlob('notes', filename)))
    await db.syncMeta.delete(note.id).catch(() => {})
    return
  }

  if (!canPush('notes')) return

  const content = serializeNote(note)
  const results = await Promise.allSettled(providers.map((p) => p.putBlob('notes', filename, content)))

  if (results.some((r) => r.status === 'fulfilled')) {
    await db.syncMeta.put({ noteId: note.id, lastSynced: new Date().toISOString() })
  }
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.warn(`[sync] ${providers[i].id} note push failed:`, r.reason)
  })
}

export async function deleteNoteFromAll(noteId: string): Promise<void> {
  const providers = connectedProviders()
  const filename  = noteIdToPath(noteId)
  const results   = await Promise.allSettled(providers.map((p) => p.deleteBlob('notes', filename)))
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.warn(`[sync] ${providers[i].id} note delete failed:`, r.reason)
  })
  await db.syncMeta.delete(noteId).catch(() => {})
}

// ---------------------------------------------------------------------------
// Content categories (journal / kanban / canvas) — debounced push from stores
// ---------------------------------------------------------------------------

export async function pushContentToAll(category: ContentCategory, item: unknown): Promise<void> {
  const adapter   = CONTENT_ADAPTERS[category]
  const synced    = adapter.toSynced(item)
  const providers = connectedProviders()
  if (providers.length === 0) return

  if (synced.noSync) {
    await Promise.allSettled(providers.map((p) => p.deleteBlob(category, synced.filename)))
    await db.syncMeta.delete(syncMetaKey(category, synced.id)).catch(() => {})
    return
  }

  if (!canPush(category)) return

  const results = await Promise.allSettled(providers.map((p) => p.putBlob(category, synced.filename, synced.content)))
  if (results.some((r) => r.status === 'fulfilled')) {
    await db.syncMeta.put({ noteId: syncMetaKey(category, synced.id), lastSynced: new Date().toISOString() })
  }
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.warn(`[sync] ${providers[i].id} ${category} push failed:`, r.reason)
  })
}

export async function deleteContentFromAll(category: ContentCategory, id: string, filename: string): Promise<void> {
  const providers = connectedProviders()
  await Promise.allSettled(providers.map((p) => p.deleteBlob(category, filename)))
  await db.syncMeta.delete(syncMetaKey(category, id)).catch(() => {})
}

// ---------------------------------------------------------------------------
// Full two-way sync — startup + "Sync Now"
// ---------------------------------------------------------------------------

async function listRemoteNotes(): Promise<Note[]> {
  const out: Note[] = []
  for (const p of connectedProviders()) {
    try {
      const blobs = await p.listBlob('notes')
      for (const blob of blobs) {
        try {
          const n = deserializeNote(blob.content)
          out.push({ ...n, embedding: n.embedding ?? [] })
        } catch { /* skip malformed */ }
      }
    } catch (err) {
      console.warn(`[sync] ${p.id} list notes failed:`, err)
    }
  }
  return out
}

async function syncNotes(): Promise<void> {
  const { readAllNotes, writePlainNote, isPlainFolderConnected } = await import('./plainFolder')

  // Pull: merge remotes by updatedAt, detect conflicts when both sides changed.
  if (canPull('notes')) {
    const remoteMap = new Map<string, Note>()
    for (const note of await listRemoteNotes()) {
      const existing = remoteMap.get(note.id)
      if (!existing || new Date(note.updatedAt) > new Date(existing.updatedAt)) remoteMap.set(note.id, note)
    }

    const localList = isPlainFolderConnected() ? await readAllNotes() : []
    const localMap  = new Map(localList.map((n) => [n.id, n]))
    const { addConflict } = useConflictStore.getState()

    for (const remote of remoteMap.values()) {
      const local = localMap.get(remote.id)
      if (local?.noSync) continue // local opted out — keep local untouched

      const remoteTs   = new Date(remote.updatedAt).getTime()
      const localTs    = local ? new Date(local.updatedAt).getTime() : -1
      const syncRecord = await db.syncMeta.get(remote.id)
      const lastSyncTs = syncRecord ? new Date(syncRecord.lastSynced).getTime() : 0

      const localChangedSinceSync  = local && localTs > lastSyncTs && lastSyncTs > 0
      const remoteChangedSinceSync = remoteTs > lastSyncTs && lastSyncTs > 0
      const contentsDiffer         = local && local.content !== remote.content

      if (local && localChangedSinceSync && remoteChangedSinceSync && contentsDiffer) {
        addConflict({ noteId: remote.id, localNote: local, remoteNote: remote, detectedAt: new Date().toISOString() })
        continue
      }

      if (!local || remoteTs > localTs) {
        if (isPlainFolderConnected()) await writePlainNote({ ...remote, embedding: local?.embedding ?? [] })
        await db.syncMeta.put({ noteId: remote.id, lastSynced: new Date().toISOString() })
      }
    }
  }

  // Push: all local notes (pushNoteToAll skips noSync + honors scope).
  if (canPush('notes')) {
    const freshNotes = isPlainFolderConnected() ? await readAllNotes() : []
    await Promise.allSettled(freshNotes.map((n) => pushNoteToAll(n)))
  }
}

async function syncContentCategory(adapter: CategoryAdapter): Promise<void> {
  const providers = connectedProviders()
  const cat       = adapter.category
  const pull      = canPull(cat)
  const push      = canPush(cat)
  if (!pull && !push) return
  let changed     = false

  // Gather remotes (merged by newest updatedAt across providers).
  const remoteMap = new Map<string, { filename: string; content: string; updatedAt: string }>()
  for (const p of providers) {
    let blobs
    try { blobs = await p.listBlob(cat) } catch (err) { console.warn(`[sync] ${p.id} list ${cat} failed:`, err); continue }
    for (const blob of blobs) {
      const parsed = adapter.parse(blob)
      if (!parsed) continue
      const existing = remoteMap.get(parsed.id)
      if (!existing || new Date(parsed.updatedAt) > new Date(existing.updatedAt)) {
        remoteMap.set(parsed.id, { filename: parsed.filename, content: parsed.content, updatedAt: parsed.updatedAt })
      }
    }
  }

  const localMap = new Map((await adapter.listLocal()).map((i) => [i.id, i]))

  // One pass over every id — whichever side has the newer updatedAt wins.
  for (const id of new Set([...remoteMap.keys(), ...localMap.keys()])) {
    const local  = localMap.get(id)
    const remote = remoteMap.get(id)

    // Opted out locally → never pull, and remove any cloud copy when pushing.
    if (local?.noSync) {
      if (push && remote) await Promise.allSettled(providers.map((p) => p.deleteBlob(cat, local.filename)))
      continue
    }

    const localTs  = local  ? new Date(local.updatedAt).getTime()  : -Infinity
    const remoteTs = remote ? new Date(remote.updatedAt).getTime() : -Infinity

    if (remote && remoteTs > localTs) {
      // Remote is newest → pull down.
      if (pull) {
        await adapter.writeLocal({ name: remote.filename, content: remote.content })
        await db.syncMeta.put({ noteId: syncMetaKey(cat, id), lastSynced: new Date().toISOString() })
        changed = true
      }
    } else if (local && localTs > remoteTs) {
      // Local is newest (or remote absent) → push up.
      if (push) {
        const results = await Promise.allSettled(providers.map((p) => p.putBlob(cat, local.filename, local.content)))
        if (results.some((r) => r.status === 'fulfilled')) {
          await db.syncMeta.put({ noteId: syncMetaKey(cat, id), lastSynced: new Date().toISOString() })
        }
      }
    }
    // Equal timestamps → already in sync, nothing to do.
  }

  if (changed) await adapter.reload()
}

export async function syncAllProviders(onStatus: (s: SyncStatus) => void): Promise<void> {
  onStatus('syncing')
  try {
    await syncNotes()
    for (const adapter of Object.values(CONTENT_ADAPTERS)) {
      await syncContentCategory(adapter)
    }
    // Settings + secrets (each gated by its own scope inside).
    const { syncConfigWithCloud } = await import('./settingsSync')
    await syncConfigWithCloud()

    onStatus('ok')
  } catch (err) {
    console.error('[sync] syncAllProviders failed:', err)
    onStatus('error')
  }
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export function anySyncProviderConnected(): boolean {
  return anyRemoteConnected()
}
