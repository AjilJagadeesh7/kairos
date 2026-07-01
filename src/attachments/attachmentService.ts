import { v4 as uuidv4 } from 'uuid'
import {
  getAttachmentsForOwner,
  getAttachment,
  upsertAttachment,
  deleteAttachment,
  deleteAttachmentsForOwner,
} from '../db/schema'
import {
  writePlainAttachment,
  readPlainAttachment,
  deletePlainAttachment,
  deletePlainAttachmentsForOwner,
  listPlainAttachments,
  plainAttachmentUrl,
} from '../sync/plainFolder'
import { assertUploadSize } from '../tiers/uploadGuard'
import type { AttachmentOwner, AttachmentRecord, AttachmentKind } from '../types'

const SCHEME = 'attachment://'

/** Fired after an owner's attachment set changes so open panels can refresh. */
export const ATTACHMENTS_CHANGED_EVENT = 'mv:attachments-changed'

/** Fired by the panel to ask the matching editor to insert a ref at the cursor. */
export const ATTACHMENT_INSERT_EVENT = 'mv:insert-attachment'

export function requestInsertAttachment(owner: AttachmentOwner, ref: string): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(ATTACHMENT_INSERT_EVENT, { detail: { owner, ref } }))
}

function notifyChanged(owner: AttachmentOwner): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(ATTACHMENTS_CHANGED_EVENT, { detail: owner }))
}

// ---------------------------------------------------------------------------
// Reference helpers — markdown stores  attachment://<ownerId>/<filename>
// ---------------------------------------------------------------------------

export function attachmentRef(owner: AttachmentOwner, filename: string): string {
  return `${SCHEME}${owner.id}/${filename}`
}

export function isAttachmentRef(src: string | null | undefined): boolean {
  return !!src && src.startsWith(SCHEME)
}

/** Parse a ref into { ownerId, filename }; filename is everything after the first '/'. */
export function parseAttachmentRef(ref: string): { ownerId: string; filename: string } | null {
  if (!isAttachmentRef(ref)) return null
  const rest = ref.slice(SCHEME.length)
  const slash = rest.indexOf('/')
  if (slash === -1) return null
  return { ownerId: rest.slice(0, slash), filename: decodeURIComponent(rest.slice(slash + 1)) }
}

// ---------------------------------------------------------------------------
// Kind / icon classification
// ---------------------------------------------------------------------------

const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'bmp', 'ico'])
const VIDEO_EXT = new Set(['mp4', 'webm', 'ogv', 'mov', 'm4v', 'mkv'])
const AUDIO_EXT = new Set(['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'opus'])

export function kindFromName(name: string): AttachmentKind {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (IMAGE_EXT.has(ext)) return 'image'
  if (VIDEO_EXT.has(ext)) return 'video'
  if (AUDIO_EXT.has(ext)) return 'audio'
  if (ext === 'pdf') return 'pdf'
  return 'file'
}

// ---------------------------------------------------------------------------
// Resolve ref -> loadable URL (objectURL from IndexedDB blob, else vault file)
// ---------------------------------------------------------------------------

const urlCache = new Map<string, string>()

function cacheKey(owner: AttachmentOwner, filename: string): string {
  return `${owner.type}:${owner.id}:${filename}`
}

/** Returns a webview-loadable URL for an attachment, or null if it can't be found. */
export async function resolveAttachment(owner: AttachmentOwner, filename: string): Promise<string | null> {
  const key = cacheKey(owner, filename)
  const cached = urlCache.get(key)
  if (cached) return cached

  const record = await getAttachment(owner, filename)
  if (record) {
    const url = URL.createObjectURL(record.blob)
    urlCache.set(key, url)
    return url
  }

  // Not in IndexedDB (e.g. synced from another device) — fall back to the vault file.
  return plainAttachmentUrl(owner, filename)
}

/** Resolve straight from a markdown ref, using the current editor owner for type. */
export async function resolveRef(owner: AttachmentOwner, ref: string): Promise<string | null> {
  const parsed = parseAttachmentRef(ref)
  if (!parsed) return null
  return resolveAttachment(owner, parsed.filename)
}

function evictCache(owner: AttachmentOwner, filename: string): void {
  const key = cacheKey(owner, filename)
  const url = urlCache.get(key)
  if (url) {
    URL.revokeObjectURL(url)
    urlCache.delete(key)
  }
}

// ---------------------------------------------------------------------------
// Import / list / remove
// ---------------------------------------------------------------------------

function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[/\\]/g, '_')
    .replace(/\s+/g, '_')
    .trim()
  return cleaned || 'file'
}

async function uniqueFilename(owner: AttachmentOwner, name: string): Promise<string> {
  const base = sanitizeFilename(name)
  if (!(await getAttachment(owner, base))) return base
  const dot = base.lastIndexOf('.')
  const stem = dot > 0 ? base.slice(0, dot) : base
  const ext = dot > 0 ? base.slice(dot) : ''
  for (let i = 1; ; i++) {
    const candidate = `${stem}-${i}${ext}`
    if (!(await getAttachment(owner, candidate))) return candidate
  }
}

/**
 * Import a file into an owner: stores the blob in IndexedDB and mirrors it to the
 * vault. Returns the markdown ref, or null if the file is rejected (size limit).
 */
export async function importFile(owner: AttachmentOwner, file: File): Promise<string | null> {
  if (!assertUploadSize(file.size, file.name)) return null

  const filename = await uniqueFilename(owner, file.name)
  const blob = file.slice(0, file.size, file.type || 'application/octet-stream')

  const record: AttachmentRecord = {
    id: uuidv4(),
    ownerType: owner.type,
    ownerId: owner.id,
    filename,
    mime: blob.type,
    size: file.size,
    blob,
    createdAt: new Date().toISOString(),
  }
  await upsertAttachment(record)

  let bytes: Uint8Array | null = null
  try {
    bytes = new Uint8Array(await file.arrayBuffer())
    await writePlainAttachment(owner, filename, bytes)
  } catch {
    // Vault mirror is best-effort; the IndexedDB blob is the primary copy.
  }

  notifyChanged(owner)
  // Push to any connected cloud provider (tier-guarded inside). Fire-and-forget.
  if (bytes) {
    const b = bytes
    void import('../sync/attachmentSync').then(m => m.pushAttachment(owner, filename, b)).catch(() => {})
  }
  return attachmentRef(owner, filename)
}

export async function listAttachments(owner: AttachmentOwner): Promise<AttachmentRecord[]> {
  const records = await getAttachmentsForOwner(owner)
  return records.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function removeAttachment(owner: AttachmentOwner, record: AttachmentRecord): Promise<void> {
  await deleteAttachment(record.id)
  await deletePlainAttachment(owner, record.filename).catch(() => {})
  evictCache(owner, record.filename)
  notifyChanged(owner)
  void import('../sync/attachmentSync').then(m => m.deleteAttachmentRemote(owner, record.filename)).catch(() => {})
}

export async function removeAllAttachments(owner: AttachmentOwner): Promise<void> {
  const records = await getAttachmentsForOwner(owner)
  for (const r of records) evictCache(owner, r.filename)
  await deleteAttachmentsForOwner(owner)
  await deletePlainAttachmentsForOwner(owner).catch(() => {})
  void import('../sync/attachmentSync').then(m => m.deleteOwnerAttachmentsRemote(owner, records.map(r => r.filename))).catch(() => {})
}

// ---------------------------------------------------------------------------
// Hydration — rebuild IndexedDB blobs from vault files (e.g. after a folder pull)
// ---------------------------------------------------------------------------

export async function hydrateAttachments(owner: AttachmentOwner): Promise<void> {
  const vaultNames = await listPlainAttachments(owner)
  if (vaultNames.length === 0) return
  for (const filename of vaultNames) {
    if (await getAttachment(owner, filename)) continue
    const bytes = await readPlainAttachment(owner, filename)
    if (!bytes) continue
    await ingestBytes(owner, filename, bytes, false)
  }
}

/**
 * Store raw bytes as an attachment: writes the IndexedDB blob and (optionally)
 * mirrors to the vault. Used by vault hydration and cloud-sync pull. No-op if an
 * attachment with the same filename already exists for the owner.
 */
export async function ingestBytes(owner: AttachmentOwner, filename: string, bytes: Uint8Array, mirrorToVault = true): Promise<void> {
  if (await getAttachment(owner, filename)) return
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  const blob = new Blob([ab], { type: mimeFromName(filename) })
  await upsertAttachment({
    id: uuidv4(),
    ownerType: owner.type,
    ownerId: owner.id,
    filename,
    mime: blob.type,
    size: blob.size,
    blob,
    createdAt: new Date().toISOString(),
  })
  if (mirrorToVault) await writePlainAttachment(owner, filename, bytes).catch(() => {})
  notifyChanged(owner)
}

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml', avif: 'image/avif',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', m4v: 'video/x-m4v',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4',
  aac: 'audio/aac', flac: 'audio/flac', opus: 'audio/opus',
  pdf: 'application/pdf',
}

function mimeFromName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return MIME_BY_EXT[ext] ?? 'application/octet-stream'
}
