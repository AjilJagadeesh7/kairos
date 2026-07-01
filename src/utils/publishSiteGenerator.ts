import type { Note } from '../types'
import { noteToStyledHtml } from './markdownToHtml'
import { buildSiteHtml } from './siteHtmlBuilder'
import { isDesktop } from './platform'
import { buildAttachmentZip, inlineHtmlAttachments, hasAttachmentRefs, collectAttachmentFiles } from './attachmentExport'

function safeFilename(title: string): string {
  return title.replace(/[^a-z0-9\-_ ]/gi, '').trim().replace(/\s+/g, '-') || 'untitled'
}

function triggerDownload(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

// ── Single-note markdown export ───────────────────────────────────────────────

function buildMarkdownContent(note: Note): string {
  const fm = note.userFrontmatter && Object.keys(note.userFrontmatter).length > 0
    ? Object.entries(note.userFrontmatter).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n') + '\n'
    : ''
  const tagsLine = note.tags.length ? `tags: [${note.tags.map(t => `"${t}"`).join(', ')}]\n` : ''
  return `---\ntitle: "${note.title.replace(/"/g, '\\"')}"\n${tagsLine}created: ${note.createdAt.slice(0, 10)}\nupdated: ${note.updatedAt.slice(0, 10)}\n${fm}---\n\n${note.content}`
}

// ── Core export helpers ───────────────────────────────────────────────────────

async function saveToDisk(content: string, defaultName: string, mime: string, ext: string): Promise<'saved' | 'cancelled'> {
  if (isDesktop()) {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const path = await save({
        defaultPath: defaultName,
        filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
      })
      if (!path) return 'cancelled'
      const { writeTextFile } = await import('@tauri-apps/plugin-fs')
      await writeTextFile(path as string, content)
      return 'saved'
    } catch {
      triggerDownload(content, defaultName, mime)
      return 'saved'
    }
  }
  triggerDownload(content, defaultName, mime)
  return 'saved'
}

async function saveBytesToDisk(bytes: Uint8Array, defaultName: string, mime: string, ext: string): Promise<'saved' | 'cancelled'> {
  if (isDesktop()) {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const path = await save({ defaultPath: defaultName, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] })
      if (!path) return 'cancelled'
      const { writeFile } = await import('@tauri-apps/plugin-fs')
      await writeFile(path as string, bytes)
      return 'saved'
    } catch {
      // Fall through to a browser download.
    }
  }
  const blob = new Blob([bytes as BlobPart], { type: mime })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: defaultName })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return 'saved'
}

// ── Individual note exports (from editor toolbar) ────────────────────────────

export async function exportNoteAsHTML(note: Note): Promise<'saved' | 'cancelled'> {
  const html = await inlineHtmlAttachments(noteToStyledHtml(note))
  return saveToDisk(html, `${safeFilename(note.title)}.html`, 'text/html', 'html')
}

export async function exportNoteAsMarkdown(note: Note): Promise<'saved' | 'cancelled'> {
  const name = safeFilename(note.title)
  const md   = buildMarkdownContent(note)
  // When the note references files, bundle them into a .zip alongside the .md.
  if (hasAttachmentRefs(note.content)) {
    const { bytes } = await buildAttachmentZip(md, `${name}.md`)
    return saveBytesToDisk(bytes, `${name}.zip`, 'application/zip', 'zip')
  }
  return saveToDisk(md, `${name}.md`, 'text/markdown', 'md')
}

// ── Batch vault export (from settings page) ──────────────────────────────────

export interface ExportProgress { done: number; total: number }

export async function exportVaultNotes(
  notes: Note[],
  format: 'html' | 'markdown',
  onProgress?: (p: ExportProgress) => void,
): Promise<{ exported: number; errors: string[]; outDir?: string }> {
  const errors: string[] = []
  let done = 0

  if (isDesktop()) {
    // Pick a folder once, then write all files into it
    let dir: string
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const selected = await open({ directory: true, multiple: false, title: `Choose export folder` })
      if (!selected || typeof selected !== 'string') return { exported: 0, errors: ['Cancelled'] }
      dir = selected
    } catch (e) {
      return { exported: 0, errors: [String(e)] }
    }

    const { writeTextFile, writeFile, mkdir } = await import('@tauri-apps/plugin-fs')
    for (const note of notes) {
      try {
        const name = safeFilename(note.title)
        if (format === 'html') {
          await writeTextFile(`${dir}/${name}.html`, await inlineHtmlAttachments(noteToStyledHtml(note)))
        } else {
          // Rewrite refs to per-note subfolders and write the files alongside.
          const { body, files } = await collectAttachmentFiles(buildMarkdownContent(note), (f, id) => `attachments/${id}/${f}`)
          await writeTextFile(`${dir}/${name}.md`, body)
          for (const [rel, bytes] of Object.entries(files)) {
            const full = `${dir}/${rel}`
            await mkdir(full.substring(0, full.lastIndexOf('/')), { recursive: true }).catch(() => {})
            await writeFile(full, bytes)
          }
        }
        done++
        onProgress?.({ done, total: notes.length })
      } catch (e) {
        errors.push(`${note.title}: ${String(e)}`)
      }
    }
    return { exported: done, errors, outDir: dir }
  } else {
    // Web: sequential downloads with small delay
    for (const note of notes) {
      try {
        const name = safeFilename(note.title)
        if (format === 'html') {
          triggerDownload(await inlineHtmlAttachments(noteToStyledHtml(note)), `${name}.html`, 'text/html')
        } else {
          triggerDownload(buildMarkdownContent(note), `${name}.md`, 'text/markdown')
        }
        done++
        onProgress?.({ done, total: notes.length })
        await new Promise(r => setTimeout(r, 80))
      } catch (e) {
        errors.push(`${note.title}: ${String(e)}`)
      }
    }
  }

  return { exported: done, errors }
}

// ── Single-file site export (sidebar + content + link graph) ─────────────────

export async function exportVaultSite(
  notes: Note[],
  siteTitle?: string,
): Promise<{ exported: number; errors: string[]; outDir?: string }> {
  if (!notes.length) return { exported: 0, errors: ['No notes selected'] }
  try {
    const html = await inlineHtmlAttachments(buildSiteHtml(notes, siteTitle))
    const res = await saveToDisk(html, 'kairos-site.html', 'text/html', 'html')
    if (res === 'cancelled') return { exported: 0, errors: ['Cancelled'] }
    return { exported: notes.length, errors: [] }
  } catch (e) {
    return { exported: 0, errors: [String(e)] }
  }
}

// ── Reveal an exported folder in the OS file manager ─────────────────────────

export async function openExportFolder(dir: string): Promise<void> {
  if (!isDesktop()) return
  const { open } = await import('@tauri-apps/plugin-shell')
  await open(dir)
}

// ── Legacy vault-level HTML export (kept for backward compat) ─────────────────

export function generateHTMLExport(notes: Note[], tagFilter?: string): void {
  const filtered = tagFilter?.trim()
    ? notes.filter(n => n.tags.includes(tagFilter.trim().replace(/^#/, '')))
    : notes
  void exportVaultNotes(filtered, 'html')
}

export function generateMarkdownExport(notes: Note[], tagFilter?: string): void {
  const filtered = tagFilter?.trim()
    ? notes.filter(n => n.tags.includes(tagFilter.trim().replace(/^#/, '')))
    : notes
  void exportVaultNotes(filtered, 'markdown')
}
