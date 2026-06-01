import { serializeNote, deserializeNote, noteIdToPath } from '../adapters/storage/noteSerializer'
import { connectedProviders, anyRemoteConnected, type RemoteProvider } from './remoteProvider'
import { canPush, canPull } from './syncRules'
import { CONTENT_ADAPTERS, type CategoryAdapter, type ContentCategory } from './categoryRegistry'
import { db } from '../db/schema'
import { useConflictStore } from '../store/useConflictStore'
import type { Note, SyncStatus, SyncCategory } from '../types'

// ---------------------------------------------------------------------------
// Provider selection — the sync matrix decides which providers a category may
// be pushed to / pulled from. Everything below routes through these helpers.
// ---------------------------------------------------------------------------

/** Connected providers this category is allowed to push to. */
function pushTargets(category: SyncCategory): RemoteProvider[] {
  return connectedProviders().filter((p) => canPush(category, p.id))
}

/** Connected providers this category is allowed to pull from. */
function pullSources(category: SyncCategory): RemoteProvider[] {
  return connectedProviders().filter((p) => canPull(category, p.id))
}

/** syncMeta keys: notes keep their bare id (backward compat); other categories
 *  are namespaced so ids never collide across content types. */
function syncMetaKey(category: SyncCategory, id: string): string {
  return category === 'notes' ? id : `${category}:${id}`
}

async function markSynced(category: SyncCategory, id: string): Promise<void> {
  await db.syncMeta.put({ noteId: syncMetaKey(category, id), lastSynced: new Date().toISOString() })
}

// ---------------------------------------------------------------------------
// Notes — single-note push (immediate, called after every save)
// ---------------------------------------------------------------------------

export async function pushNoteToAll(note: Note): Promise<void> {
  const filename = noteIdToPath(note.id)

  // Opted out → make sure no stale cloud copy lingers on any provider.
  if (note.noSync) return deleteNoteFromAll(note.id)

  const targets = pushTargets('notes')
  if (targets.length === 0) return

  const content = serializeNote(note)
  const results = await Promise.allSettled(targets.map((p) => p.putBlob('notes', filename, content)))

  if (results.some((r) => r.status === 'fulfilled')) await markSynced('notes', note.id)
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.warn(`[sync] ${targets[i].id} note push failed:`, r.reason)
  })
}

export async function deleteNoteFromAll(noteId: string): Promise<void> {
  const filename = noteIdToPath(noteId)
  // Delete is cleanup — remove from every connected provider regardless of rules.
  await Promise.allSettled(connectedProviders().map((p) => p.deleteBlob('notes', filename)))
  await db.syncMeta.delete(noteId).catch(() => {})
}

// ---------------------------------------------------------------------------
// Content categories (journal / kanban / canvas) — debounced push from stores
// ---------------------------------------------------------------------------

export async function pushContentToAll(category: ContentCategory, item: unknown): Promise<void> {
  const synced = CONTENT_ADAPTERS[category].toSynced(item)

  if (synced.noSync) return deleteContentFromAll(category, synced.id, synced.filename)

  const targets = pushTargets(category)
  if (targets.length === 0) return

  const results = await Promise.allSettled(targets.map((p) => p.putBlob(category, synced.filename, synced.content)))
  if (results.some((r) => r.status === 'fulfilled')) await markSynced(category, synced.id)
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.warn(`[sync] ${targets[i].id} ${category} push failed:`, r.reason)
  })
}

export async function deleteContentFromAll(category: ContentCategory, id: string, filename: string): Promise<void> {
  await Promise.allSettled(connectedProviders().map((p) => p.deleteBlob(category, filename)))
  await db.syncMeta.delete(syncMetaKey(category, id)).catch(() => {})
}

// ---------------------------------------------------------------------------
// Full two-way sync — startup + "Sync Now"
// ---------------------------------------------------------------------------

async function listRemoteNotes(sources: RemoteProvider[]): Promise<Note[]> {
  const out: Note[] = []
  for (const p of sources) {
    try {
      for (const blob of await p.listBlob('notes')) {
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

  // Pull from allowed sources: merge by updatedAt, flag genuine conflicts.
  const sources = pullSources('notes')
  if (sources.length > 0) {
    const remoteMap = new Map<string, Note>()
    for (const note of await listRemoteNotes(sources)) {
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
        await markSynced('notes', remote.id)
      }
    }
  }

  // Push every local note (pushNoteToAll honors per-provider rules + noSync).
  if (pushTargets('notes').length > 0) {
    const freshNotes = isPlainFolderConnected() ? await readAllNotes() : []
    await Promise.allSettled(freshNotes.map((n) => pushNoteToAll(n)))
  }
}

async function syncContentCategory(adapter: CategoryAdapter): Promise<void> {
  const cat     = adapter.category
  const sources = pullSources(cat)
  const targets = pushTargets(cat)
  if (sources.length === 0 && targets.length === 0) return
  let changed   = false

  // Gather remotes from allowed sources (merged by newest updatedAt).
  const remoteMap = new Map<string, { filename: string; content: string; updatedAt: string }>()
  for (const p of sources) {
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
      if (remote) await Promise.allSettled(targets.map((p) => p.deleteBlob(cat, local.filename)))
      continue
    }

    const localTs  = local  ? new Date(local.updatedAt).getTime()  : -Infinity
    const remoteTs = remote ? new Date(remote.updatedAt).getTime() : -Infinity

    if (remote && remoteTs > localTs) {
      // Remote is newest → pull down (a source produced it, so pull is allowed).
      await adapter.writeLocal({ name: remote.filename, content: remote.content })
      await markSynced(cat, id)
      changed = true
    } else if (local && localTs > remoteTs && targets.length > 0) {
      // Local is newest (or remote absent) → push to allowed targets.
      const results = await Promise.allSettled(targets.map((p) => p.putBlob(cat, local.filename, local.content)))
      if (results.some((r) => r.status === 'fulfilled')) await markSynced(cat, id)
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
    // Settings + secrets (each gated per provider inside).
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
