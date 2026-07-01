/**
 * Cloud sync for media attachments. Each attachment is a binary object stored on
 * every connected provider that supports binary I/O, under a path mirroring the
 * vault layout:
 *   notes:   attachments/<noteId>/<file>
 *   journal: attachments/journal/<date>/<file>
 *
 * Tier limits are reused from the note/journal sync path: the total counts
 * toward `syncStorageBytes` (guardSyncQuota) and each file is capped at
 * `fileSizeBytes`. Free tier has a 0-byte quota, so nothing uploads there.
 */
import { connectedProviders, type RemoteProvider } from './remoteProvider'
import { canPush, canPull } from './syncRules'
import { guardSyncQuota } from '../tiers/syncGuard'
import { getActiveLimits } from '../tiers/tierProvider'
import { db, getAllAttachments, getAttachment } from '../db/schema'
import { ingestBytes } from '../attachments/attachmentService'
import type { AttachmentOwner, SyncCategory } from '../types'

const ROOT = 'attachments'

function ownerDir(owner: AttachmentOwner): string {
  return owner.type === 'journal' ? `${ROOT}/journal/${owner.id}` : `${ROOT}/${owner.id}`
}

function relPath(owner: AttachmentOwner, filename: string): string {
  return `${ownerDir(owner)}/${filename}`
}

/** Map a provider-relative attachment path back to its owner + filename. */
export function parseAttachmentPath(path: string): { owner: AttachmentOwner; filename: string } | null {
  const parts = path.split('/')
  if (parts[0] !== ROOT) return null
  if (parts[1] === 'journal' && parts.length >= 4) {
    return { owner: { type: 'journal', id: parts[2] }, filename: parts.slice(3).join('/') }
  }
  if (parts.length >= 3) {
    return { owner: { type: 'note', id: parts[1] }, filename: parts.slice(2).join('/') }
  }
  return null
}

/** The parent sync category whose push/pull rules govern this owner's media. */
function categoryFor(owner: AttachmentOwner): SyncCategory {
  return owner.type === 'journal' ? 'journal' : 'notes'
}

function binaryProviders(): RemoteProvider[] {
  return connectedProviders().filter(p => p.putBinary && p.getBinary && p.listBinary && p.deleteBinary)
}

function withinFileLimit(size: number): boolean {
  const { fileSizeBytes } = getActiveLimits()
  return !isFinite(fileSizeBytes) || size <= fileSizeBytes
}

/** Honor a parent note/journal that opted out of cloud sync (noSync). */
async function ownerOptedOut(owner: AttachmentOwner): Promise<boolean> {
  try {
    if (owner.type === 'journal') return !!(await db.journal.get(owner.id))?.noSync
    return !!(await db.notes.get(owner.id))?.noSync
  } catch {
    return false
  }
}

// ── Push ─────────────────────────────────────────────────────────────────────

/** Upload one attachment to every allowed, binary-capable provider. */
export async function pushAttachment(owner: AttachmentOwner, filename: string, bytes: Uint8Array): Promise<void> {
  if (!guardSyncQuota()) return
  if (!withinFileLimit(bytes.length)) return
  if (await ownerOptedOut(owner)) return
  const cat = categoryFor(owner)
  const targets = binaryProviders().filter(p => canPush(cat, p.id))
  if (targets.length === 0) return
  const path = relPath(owner, filename)
  await Promise.allSettled(targets.map(p => p.putBinary!(path, bytes)))
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteAttachmentRemote(owner: AttachmentOwner, filename: string): Promise<void> {
  const path = relPath(owner, filename)
  await Promise.allSettled(binaryProviders().map(p => p.deleteBinary!(path)))
}

export async function deleteOwnerAttachmentsRemote(owner: AttachmentOwner, filenames: string[]): Promise<void> {
  for (const f of filenames) await deleteAttachmentRemote(owner, f)
}

// ── Full two-way reconcile (called from syncAllProviders) ─────────────────────

export async function syncAttachments(): Promise<void> {
  const providers = binaryProviders()
  if (providers.length === 0) return

  const local = await getAllAttachments()
  const localPaths = new Set(local.map(a => relPath({ type: a.ownerType, id: a.ownerId }, a.filename)))

  // Pull: anything on an allowed source we don't have locally → ingest it.
  for (const p of providers) {
    let remotePaths: string[]
    try { remotePaths = await p.listBinary!(ROOT) } catch { continue }
    for (const path of remotePaths) {
      if (localPaths.has(path)) continue
      const parsed = parseAttachmentPath(path)
      if (!parsed) continue
      if (!canPull(categoryFor(parsed.owner), p.id)) continue
      const bytes = await p.getBinary!(path).catch(() => null)
      if (!bytes) continue
      await ingestBytes(parsed.owner, parsed.filename, bytes)
      localPaths.add(path)
    }
  }

  // Push: every local attachment to allowed targets (idempotent overwrite).
  if (!guardSyncQuota()) return
  for (const a of local) {
    const owner: AttachmentOwner = { type: a.ownerType, id: a.ownerId }
    if (!withinFileLimit(a.size)) continue
    if (await ownerOptedOut(owner)) continue
    const targets = providers.filter(p => canPush(categoryFor(owner), p.id))
    if (targets.length === 0) continue
    const rec = await getAttachment(owner, a.filename)
    if (!rec) continue
    const bytes = new Uint8Array(await rec.blob.arrayBuffer())
    await Promise.allSettled(targets.map(p => p.putBinary!(relPath(owner, a.filename), bytes)))
  }
}
