import { v4 as uuidv4 } from 'uuid'
import {
  getAttachment,
  getAllAttachments,
  upsertAttachment,
  deleteAttachment as dbDeleteAttachment,
} from '../db/schema'
import {
  writePlainAttachment,
  readPlainAttachment,
  deletePlainAttachment,
  writeAttachmentManifest,
} from '../sync/plainFolder'
import { assertUploadSize } from '../tiers/uploadGuard'
import type { Attachment, AttachmentMeta, AttachmentKind } from '../types'

const SCHEME = 'attachment://'

/** Fired after the attachment set changes so open stores/panels can refresh. */
export const ATTACHMENTS_CHANGED_EVENT = 'mv:attachments-changed'

function notifyChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(ATTACHMENTS_CHANGED_EVENT))
}

// ---------------------------------------------------------------------------
// Reference helpers — markdown stores  attachment://<id>
// ---------------------------------------------------------------------------

export function attachmentRef(id: string): string {
  return `${SCHEME}${id}`
}

export function isAttachmentRef(src: string | null | undefined): boolean {
  return !!src && src.startsWith(SCHEME)
}

/** Parse a ref into its attachment id, or null if not an attachment ref. */
export function parseAttachmentRef(ref: string | null | undefined): string | null {
  if (!isAttachmentRef(ref)) return null
  const id = ref!.slice(SCHEME.length).split(/[/?#]/)[0].trim()
  return id || null
}

// ---------------------------------------------------------------------------
// Kind / mime classification
// ---------------------------------------------------------------------------

const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'bmp', 'ico'])
const VIDEO_EXT = new Set(['mp4', 'webm', 'ogv', 'mov', 'm4v', 'mkv'])
const AUDIO_EXT = new Set(['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'opus'])

export function kindFromName(name: string | undefined | null): AttachmentKind {
  const ext = (name ?? '').split('.').pop()?.toLowerCase() ?? ''
  if (IMAGE_EXT.has(ext)) return 'image'
  if (VIDEO_EXT.has(ext)) return 'video'
  if (AUDIO_EXT.has(ext)) return 'audio'
  if (ext === 'pdf') return 'pdf'
  return 'file'
}

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml', avif: 'image/avif',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', m4v: 'video/x-m4v',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4',
  aac: 'audio/aac', flac: 'audio/flac', opus: 'audio/opus',
  pdf: 'application/pdf',
}

export function mimeFromName(name: string | undefined | null): string {
  const ext = (name ?? '').split('.').pop()?.toLowerCase() ?? ''
  return MIME_BY_EXT[ext] ?? 'application/octet-stream'
}

// ---------------------------------------------------------------------------
// Resolve id -> loadable URL (objectURL from the IndexedDB blob, else vault file)
// ---------------------------------------------------------------------------

const urlCache = new Map<string, string>()

/** Returns a webview-loadable URL for an attachment, or null if it can't be found. */
export async function resolveAttachment(id: string): Promise<string | null> {
  const cached = urlCache.get(id)
  if (cached) return cached

  const record = await getAttachment(id)
  if (record) {
    const url = URL.createObjectURL(record.blob)
    urlCache.set(id, url)
    return url
  }
  return null
}

function evictCache(id: string): void {
  const url = urlCache.get(id)
  if (url) {
    URL.revokeObjectURL(url)
    urlCache.delete(id)
  }
}

// ---------------------------------------------------------------------------
// Naming
// ---------------------------------------------------------------------------

function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[/\\]/g, '_').replace(/\s+/g, '_').trim()
  return cleaned || 'file'
}

/** A name unique within its folder, appending -1, -2, … before the extension. */
function uniqueName(base: string, folder: string | undefined, existing: Attachment[]): string {
  const taken = new Set(
    existing.filter(a => (a.folder ?? '') === (folder ?? '')).map(a => a.name),
  )
  if (!taken.has(base)) return base
  const dot = base.lastIndexOf('.')
  const stem = dot > 0 ? base.slice(0, dot) : base
  const ext = dot > 0 ? base.slice(dot) : ''
  for (let i = 1; ; i++) {
    const candidate = `${stem}-${i}${ext}`
    if (!taken.has(candidate)) return candidate
  }
}

// ---------------------------------------------------------------------------
// Vault manifest — attachments/attachments.json ( { items: AttachmentMeta[] } )
// Lets other devices map file paths back to a stable id on pull.
// ---------------------------------------------------------------------------

/** Strip the blob to get the metadata stored in the manifest / synced remotely. */
export function attachmentMeta(a: Attachment): AttachmentMeta {
  return {
    id: a.id, name: a.name, folder: a.folder, mime: a.mime,
    size: a.size, createdAt: a.createdAt, updatedAt: a.updatedAt, noSync: a.noSync,
  }
}

async function rewriteManifest(): Promise<void> {
  const items = (await getAllAttachments()).map(attachmentMeta)
  await writeAttachmentManifest(JSON.stringify({ items }, null, 2)).catch(() => {})
}

function pushRemote(record: Attachment, bytes: Uint8Array): void {
  void import('../sync/attachmentSync').then(m => m.pushAttachment(record, bytes)).catch(() => {})
}

function deleteRemote(folder: string | undefined, name: string): void {
  void import('../sync/attachmentSync').then(m => m.deleteAttachmentRemote(folder, name)).catch(() => {})
}

// ---------------------------------------------------------------------------
// Import / delete / rename / move
// ---------------------------------------------------------------------------

/**
 * Import a file as a standalone attachment: stores the blob in IndexedDB, mirrors
 * it to the vault, and pushes to connected providers. Returns the record, or null
 * if the file is rejected (size limit).
 */
export async function importAttachment(file: File, folder?: string): Promise<Attachment | null> {
  if (!assertUploadSize(file.size, file.name)) return null

  const existing = await getAllAttachments()
  const name = uniqueName(sanitizeFilename(file.name), folder, existing)
  const blob = file.slice(0, file.size, file.type || mimeFromName(name))
  const now = new Date().toISOString()

  const record: Attachment = {
    id: uuidv4(),
    name,
    folder: folder || undefined,
    mime: blob.type,
    size: file.size,
    blob,
    createdAt: now,
    updatedAt: now,
  }
  await upsertAttachment(record)

  let bytes: Uint8Array | null = null
  try {
    bytes = new Uint8Array(await file.arrayBuffer())
    await writePlainAttachment(record.folder, name, bytes)
  } catch {
    // Vault mirror is best-effort; the IndexedDB blob is the primary copy.
  }

  await rewriteManifest()
  notifyChanged()
  if (bytes) pushRemote(record, bytes)
  return record
}

export async function removeAttachment(record: Attachment): Promise<void> {
  await dbDeleteAttachment(record.id)
  await deletePlainAttachment(record.folder, record.name).catch(() => {})
  evictCache(record.id)
  await rewriteManifest()
  notifyChanged()
  deleteRemote(record.folder, record.name)
}

async function bytesOf(record: Attachment): Promise<Uint8Array> {
  return new Uint8Array(await record.blob.arrayBuffer())
}

/** Relocate an attachment's vault file when its folder/name changes, then persist. */
async function relocate(record: Attachment, next: { name?: string; folder?: string }): Promise<Attachment> {
  const oldFolder = record.folder
  const oldName = record.name
  const name = next.name ? sanitizeFilename(next.name) : record.name
  const folder = 'folder' in next ? (next.folder || undefined) : record.folder
  const updated: Attachment = { ...record, name, folder, updatedAt: new Date().toISOString() }

  const bytes = await bytesOf(record)
  if (oldFolder !== folder || oldName !== name) {
    await deletePlainAttachment(oldFolder, oldName).catch(() => {})
    await writePlainAttachment(folder, name, bytes).catch(() => {})
  }
  await upsertAttachment(updated)
  await rewriteManifest()
  notifyChanged()

  if (oldFolder !== folder || oldName !== name) deleteRemote(oldFolder, oldName)
  pushRemote(updated, bytes)
  return updated
}

export function renameAttachment(record: Attachment, newName: string): Promise<Attachment> {
  return relocate(record, { name: newName })
}

export function moveAttachment(record: Attachment, folder: string | undefined): Promise<Attachment> {
  return relocate(record, { folder })
}

/** Download an attachment via a temporary object URL. */
export async function downloadAttachment(record: Attachment): Promise<void> {
  const url = await resolveAttachment(record.id)
  if (!url) return
  const a = Object.assign(document.createElement('a'), { href: url, download: record.name })
  a.click()
}

// ---------------------------------------------------------------------------
// Sync ingestion — rebuild an IndexedDB record from a pulled blob
// ---------------------------------------------------------------------------

/** Store a pulled attachment (metadata + bytes). No-op if the id already exists. */
export async function ingestAttachment(meta: AttachmentMeta, bytes: Uint8Array): Promise<void> {
  if (await getAttachment(meta.id)) return
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  const blob = new Blob([ab], { type: meta.mime || mimeFromName(meta.name) })
  await upsertAttachment({ ...meta, blob })
  await writePlainAttachment(meta.folder, meta.name, bytes).catch(() => {})
  notifyChanged()
}

/** Rebuild missing IndexedDB blobs from the vault manifest + files (e.g. after a
 *  folder pull that brought files but no IndexedDB). */
export async function hydrateFromVault(manifestJson: string): Promise<void> {
  let items: AttachmentMeta[]
  try { items = (JSON.parse(manifestJson) as { items?: AttachmentMeta[] }).items ?? [] } catch { return }
  for (const meta of items) {
    if (await getAttachment(meta.id)) continue
    const bytes = await readPlainAttachment(meta.folder, meta.name)
    if (!bytes) continue
    await ingestAttachment(meta, bytes)
  }
}
