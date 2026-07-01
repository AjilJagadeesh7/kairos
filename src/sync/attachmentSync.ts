/**
 * Cloud sync for standalone attachments. Each file is a binary object stored on
 * every connected, binary-capable provider under a path mirroring the vault:
 *   attachments/<folder>/<name>
 * plus a manifest `attachments/attachments.json` ({ items: AttachmentMeta[] })
 * so another device can map a pulled file back to its stable id/folder.
 *
 * Attachments follow the `notes` push/pull rules and count toward the same
 * `syncStorageBytes` tier quota; each file is capped at `fileSizeBytes`.
 */
import { connectedProviders, type RemoteProvider } from './remoteProvider'
import { canPush, canPull } from './syncRules'
import { guardSyncQuota } from '../tiers/syncGuard'
import { getActiveLimits } from '../tiers/tierProvider'
import { getAllAttachments, getAttachment } from '../db/schema'
import { ingestAttachment, attachmentMeta } from '../attachments/attachmentService'
import type { Attachment, AttachmentMeta, SyncCategory } from '../types'

const ROOT = 'attachments'
const MANIFEST_PATH = 'attachments/attachments.json'
const CATEGORY: SyncCategory = 'notes' // attachments follow the notes push/pull rules

function relPath(folder: string | undefined, name: string): string {
  const f = (folder ?? '').replace(/^\/+|\/+$/g, '')
  return f ? `${ROOT}/${f}/${name}` : `${ROOT}/${name}`
}

function binaryProviders(): RemoteProvider[] {
  return connectedProviders().filter(p => p.putBinary && p.getBinary && p.deleteBinary)
}

function withinFileLimit(size: number): boolean {
  const { fileSizeBytes } = getActiveLimits()
  return !isFinite(fileSizeBytes) || size <= fileSizeBytes
}

async function pushManifest(targets: RemoteProvider[]): Promise<void> {
  const all = await getAllAttachments()
  const items = all.filter(a => !a.noSync).map(attachmentMeta)
  const bytes = new TextEncoder().encode(JSON.stringify({ items }))
  await Promise.allSettled(targets.map(p => p.putBinary!(MANIFEST_PATH, bytes)))
}

// ── Push single (called on import / rename / move) ────────────────────────────
export async function pushAttachment(record: Attachment, bytes: Uint8Array): Promise<void> {
  if (record.noSync) return
  if (!guardSyncQuota()) return
  if (!withinFileLimit(bytes.length)) return
  const targets = binaryProviders().filter(p => canPush(CATEGORY, p.id))
  if (targets.length === 0) return
  await Promise.allSettled(targets.map(p => p.putBinary!(relPath(record.folder, record.name), bytes)))
  await pushManifest(targets)
}

// ── Delete ────────────────────────────────────────────────────────────────────
export async function deleteAttachmentRemote(folder: string | undefined, name: string): Promise<void> {
  const path = relPath(folder, name)
  await Promise.allSettled(binaryProviders().map(p => p.deleteBinary!(path)))
}

// ── Full two-way reconcile (called from syncAllProviders) ─────────────────────
export async function syncAttachments(): Promise<void> {
  const providers = binaryProviders()
  if (providers.length === 0) return

  // Pull: read each allowed provider's manifest, ingest any file we don't have.
  for (const p of providers) {
    if (!canPull(CATEGORY, p.id)) continue
    const manifestBytes = await p.getBinary!(MANIFEST_PATH).catch(() => null)
    if (!manifestBytes) continue
    let items: AttachmentMeta[]
    try {
      items = (JSON.parse(new TextDecoder().decode(manifestBytes)) as { items?: AttachmentMeta[] }).items ?? []
    } catch { continue }
    for (const meta of items) {
      if (await getAttachment(meta.id)) continue
      const bytes = await p.getBinary!(relPath(meta.folder, meta.name)).catch(() => null)
      if (!bytes) continue
      await ingestAttachment(meta, bytes)
    }
  }

  // Push: every local attachment to allowed targets (idempotent overwrite) + manifest.
  if (!guardSyncQuota()) return
  const targets = providers.filter(p => canPush(CATEGORY, p.id))
  if (targets.length === 0) return
  const local = await getAllAttachments()
  for (const a of local) {
    if (a.noSync) continue
    if (!withinFileLimit(a.size)) continue
    const bytes = new Uint8Array(await a.blob.arrayBuffer())
    await Promise.allSettled(targets.map(p => p.putBinary!(relPath(a.folder, a.name), bytes)))
  }
  await pushManifest(targets)
}
