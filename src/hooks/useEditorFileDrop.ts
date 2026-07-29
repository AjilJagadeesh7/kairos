import { useEffect } from 'react'
import { toast } from 'sonner'
import { Crepe } from '@milkdown/crepe'
import { editorViewCtx } from '@milkdown/core'

import { importAttachment, attachmentRef } from '../attachments/attachmentService'
import { isDesktop } from '../utils/platform'
import type { MutableRefObject, RefObject } from 'react'

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  svg: 'image/svg+xml', avif: 'image/avif', bmp: 'image/bmp',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', m4v: 'video/x-m4v', mkv: 'video/x-matroska',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac',
  pdf: 'application/pdf', csv: 'text/csv', json: 'application/json', txt: 'text/plain',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  zip: 'application/zip',
}

function mimeForFile(name: string): string {
  return MIME_BY_EXT[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream'
}

/** Read OS paths into File objects via the Tauri fs plugin. */
async function filesFromPaths(paths: string[]): Promise<File[]> {
  const { readFile } = await import('@tauri-apps/plugin-fs')
  const out: File[] = []
  for (const path of paths) {
    try {
      const bytes = await readFile(path)
      const name = path.split(/[/\\]/).pop() ?? 'file'
      out.push(new File([bytes as BlobPart], name, { type: mimeForFile(name) }))
    } catch { /* skip unreadable path */ }
  }
  return out
}

/**
 * Drag-drop / paste of any file (image, video, audio, pdf, xlsx, csv, …):
 * imports it as an attachment and inserts a node carrying the attachment:// ref.
 * Dropped files always go through here; image *paste* is left to Crepe.
 *
 * Also removes nodes that reference an attachment deleted elsewhere in the app.
 */
export function useEditorFileDrop(
  rootRef: RefObject<HTMLDivElement | null>,
  crepeRef: MutableRefObject<Crepe | null>,
  attachmentsRef: MutableRefObject<boolean | undefined>,
): void {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const insertRef = (ref: string, name: string) => {
      crepeRef.current?.editor.action(ctx => {
        const view = ctx.get(editorViewCtx)
        const { state } = view
        const nodeType = state.schema.nodes['image-block'] ?? state.schema.nodes['image']
        if (!nodeType) return
        const node = nodeType.create({ src: ref, alt: name, title: name })
        view.dispatch(state.tr.replaceSelectionWith(node).scrollIntoView())
      })
    }

    // Copy dropped/pasted files into the vault (+ IndexedDB) as standalone
    // attachments and insert their previews. One loader toast spans the upload.
    const runImport = async (getFiles: () => Promise<File[]>) => {
      if (!attachmentsRef.current) return
      const tId = toast.loading('Adding attachment…')
      try {
        const files = await getFiles()
        if (files.length === 0) { toast.dismiss(tId); return }
        let added = 0
        for (const file of files) {
          const rec = await importAttachment(file)
          if (rec) { insertRef(attachmentRef(rec.id), rec.name); added++ }
        }
        if (added === 0) toast.dismiss(tId)          // rejected (e.g. size) — guard already warned
        else toast.success(added > 1 ? `Added ${added} files` : 'Attachment added', { id: tId })
      } catch {
        toast.error('Failed to add attachment', { id: tId })
      }
    }

    // Linux/WebKitGTK + Tauri deliver dragged OS files as file:// URIs (not File
    // objects). Read their bytes via the fs plugin, then import like any file.
    const fileUrisFrom = (dt: DataTransfer | null): string[] => {
      const raw = dt?.getData('text/uri-list') || dt?.getData('text/plain') || ''
      return raw.split(/\r?\n/).map(s => s.trim()).filter(s => s.startsWith('file://'))
    }

    // Allow file drops to fire a `drop` event on the editor.
    const onDragOver = (e: DragEvent) => {
      const types = Array.from(e.dataTransfer?.types ?? [])
      if (types.includes('Files') || types.includes('text/uri-list')) {
        e.preventDefault()
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
      }
    }
    const onDrop = (e: DragEvent) => {
      const files = Array.from(e.dataTransfer?.files ?? [])
      if (files.length > 0) {
        e.preventDefault(); e.stopPropagation()
        void runImport(async () => files)
        return
      }
      const uris = fileUrisFrom(e.dataTransfer)
      if (uris.length > 0) {
        e.preventDefault(); e.stopPropagation()
        void runImport(() => filesFromPaths(uris.map(u => decodeURIComponent(u.replace(/^file:\/\//, '')))))
      }
    }
    const onPaste = (e: ClipboardEvent) => {
      // Images are handled by Crepe's paste; everything else imports as a file.
      const files = Array.from(e.clipboardData?.files ?? []).filter(f => !f.type.startsWith('image/'))
      if (files.length > 0) {
        e.preventDefault(); e.stopPropagation()
        void runImport(async () => files)
      }
    }

    // Remove any node referencing a deleted attachment from the open document.
    const onStrip = (e: Event) => {
      const ref = (e as CustomEvent<{ ref: string }>).detail?.ref
      if (!ref) return
      crepeRef.current?.editor.action(ctx => {
        const view = ctx.get(editorViewCtx)
        const { state } = view
        const ranges: Array<{ from: number; to: number }> = []
        state.doc.descendants((node, pos) => {
          if ((node.type.name === 'image' || node.type.name === 'image-block') && node.attrs.src === ref) {
            ranges.push({ from: pos, to: pos + node.nodeSize })
          }
        })
        if (ranges.length === 0) return
        const tr = state.tr
        for (let i = ranges.length - 1; i >= 0; i--) tr.delete(ranges[i].from, ranges[i].to)
        view.dispatch(tr)
      })
    }

    root.addEventListener('dragover', onDragOver, true)
    root.addEventListener('drop', onDrop, true)
    root.addEventListener('paste', onPaste, true)
    window.addEventListener('mv:strip-attachment', onStrip)

    // Desktop (Tauri): use the native drag-drop event. WebKitGTK's HTML5 file
    // drop is unreliable (it inserts the path); the native event gives real
    // filesystem paths and bypasses WebKit's editor. Only act when the drop
    // lands over THIS editor instance (so split panes route correctly).
    let unlistenNative: (() => void) | undefined
    let disposed = false
    if (isDesktop()) {
      void (async () => {
        try {
          const { getCurrentWebview } = await import('@tauri-apps/api/webview')
          const un = await getCurrentWebview().onDragDropEvent(ev => {
            if (ev.payload.type !== 'drop') return
            if (ev.payload.paths.length === 0) return
            const node = rootRef.current
            if (!node) return
            const dpr = window.devicePixelRatio || 1
            const x = ev.payload.position.x / dpr
            const y = ev.payload.position.y / dpr
            const r = node.getBoundingClientRect()
            if (x < r.left || x > r.right || y < r.top || y > r.bottom) return
            const paths = ev.payload.paths
            void runImport(() => filesFromPaths(paths))
          })
          if (disposed) un()
          else unlistenNative = un
        } catch { /* native drag-drop unavailable */ }
      })()
    }

    return () => {
      disposed = true
      unlistenNative?.()
      root.removeEventListener('dragover', onDragOver, true)
      root.removeEventListener('drop', onDrop, true)
      root.removeEventListener('paste', onPaste, true)
      window.removeEventListener('mv:strip-attachment', onStrip)
    }
  }, [rootRef, crepeRef, attachmentsRef])
}
