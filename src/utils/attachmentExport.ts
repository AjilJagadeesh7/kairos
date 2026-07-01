import { zipSync, strToU8 } from 'fflate'
import { getAttachment } from '../db/schema'
import { parseAttachmentRef, kindFromName } from '../attachments/attachmentService'

// Matches an attachment:// reference inside markdown or generated HTML.
const REF_RE = /attachment:\/\/[^\s)"'>]+/g

export interface ResolvedRef { ref: string; id: string; filename: string; bytes: Uint8Array | null; mime: string }

/**
 * Load the bytes + name for every distinct attachment ref in some text. Refs are
 * standalone `attachment://<id>` links, so this works across many notes (e.g. a
 * combined site export), not just one.
 */
async function resolveRefs(text: string): Promise<Map<string, ResolvedRef>> {
  const map = new Map<string, ResolvedRef>()
  for (const m of text.matchAll(REF_RE)) {
    const ref = m[0]
    if (map.has(ref)) continue
    const id = parseAttachmentRef(ref)
    if (!id) continue
    const rec = await getAttachment(id)
    const filename = rec?.name ?? id
    const bytes = rec ? new Uint8Array(await rec.blob.arrayBuffer()) : null
    map.set(ref, { ref, id, filename, bytes, mime: rec?.mime || mimeFor(filename) })
  }
  return map
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return btoa(binary)
}

// ── Markdown → zip bundle ────────────────────────────────────────────────────

export interface ZipResult { bytes: Uint8Array; included: number; missing: string[] }

/**
 * Bundle markdown + its attachments into a .zip. References are rewritten from
 * `attachment://…` to relative `attachments/<filename>` paths so the .md is
 * portable. Missing attachments are reported but never abort the export.
 */
export interface CollectedFiles { body: string; files: Record<string, Uint8Array>; missing: string[] }

/**
 * Rewrite attachment refs in markdown to relative paths and gather their bytes.
 * `pathFor(filename, id)` decides the relative path (e.g. flat for a single note,
 * or per-id subfolders for a batch export).
 */
export async function collectAttachmentFiles(
  markdown: string,
  pathFor: (filename: string, id: string) => string,
): Promise<CollectedFiles> {
  const refs = await resolveRefs(markdown)
  const files: Record<string, Uint8Array> = {}
  const missing: string[] = []
  let body = markdown

  for (const { ref, id, filename, bytes } of refs.values()) {
    const rel = pathFor(filename, id)
    body = body.split(ref).join(rel)
    if (bytes) files[rel] = bytes
    else missing.push(filename)
  }
  return { body, files, missing }
}

export async function buildAttachmentZip(markdown: string, mdFilename: string): Promise<ZipResult> {
  const { body, files, missing } = await collectAttachmentFiles(markdown, f => `attachments/${f}`)
  files[mdFilename] = strToU8(body)
  return { bytes: zipSync(files, { level: 6 }), included: Object.keys(files).length - 1, missing }
}

// ── HTML → inline data URLs ──────────────────────────────────────────────────

/**
 * Replace `<img src="attachment://…">` placeholders in generated HTML with
 * inlined data URLs, upgrading video/audio/pdf to the matching media element so
 * the exported single-file HTML is self-contained.
 */
export async function inlineHtmlAttachments(html: string): Promise<string> {
  const refs = await resolveRefs(html)
  if (refs.size === 0) return html

  // Replace each <img …src="attachment://…"…> with the appropriate element.
  return html.replace(/<img\b[^>]*\bsrc="(attachment:\/\/[^"]+)"[^>]*>/g, (_full: string, ref: string) => {
    const r = refs.get(ref)
    if (!r || !r.bytes) {
      return `<p style="color:#888;font-size:13px">⚠ Missing attachment: ${escapeHtml(r?.filename ?? ref)}</p>`
    }
    const dataUrl = `data:${r.mime};base64,${bytesToBase64(r.bytes)}`
    const kind = kindFromName(r.filename)
    if (kind === 'video') return `<video controls src="${dataUrl}" style="max-width:100%"></video>`
    if (kind === 'audio') return `<audio controls src="${dataUrl}" style="width:100%"></audio>`
    if (kind === 'pdf')   return `<embed src="${dataUrl}" type="application/pdf" style="width:100%;height:600px">`
    return `<img src="${dataUrl}" alt="${escapeHtml(r.filename)}" loading="lazy">`
  })
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
}

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml', avif: 'image/avif',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', m4v: 'video/x-m4v',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4',
  aac: 'audio/aac', flac: 'audio/flac', opus: 'audio/opus',
  pdf: 'application/pdf',
}

function mimeFor(name: string): string {
  return MIME_BY_EXT[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream'
}

/** True when the text contains at least one attachment reference. */
export function hasAttachmentRefs(text: string): boolean {
  REF_RE.lastIndex = 0
  return REF_RE.test(text)
}
