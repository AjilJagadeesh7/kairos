import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../../store/useAppStore'
import { Crepe } from '@milkdown/crepe'
import { editorViewCtx } from '@milkdown/core'
import { TextSelection } from '@milkdown/prose/state'
import { replaceAll } from '@milkdown/utils'
import { math } from '@milkdown/plugin-math'
import { wikilinkHighlightPlugin } from './wikilinkPlugin'
import { calloutPlugin } from './calloutPlugin'
import { linkInputRulePlugin, linkKeymapPlugin } from './linkInputRulePlugin'
import { pasteSanitizePlugin } from './pasteSanitizePlugin'
import { imageLazyPlugin } from './imageLazyPlugin'
import { attachmentRenderPlugin } from './attachmentRenderPlugin'
import { queryBlockPlugin } from './queryBlockPlugin'
import { chartCodeBlockPlugin } from './chartCodeBlockPlugin'
import { mobileAddBlockPlugin } from './mobileAddBlockPlugin'
import { mobileListToolbarPlugin } from './mobileListToolbarPlugin'
import { clickBelowAppendPlugin } from './clickBelowAppendPlugin'
import { assertUploadSize } from '../../../tiers/uploadGuard'
import { importAttachment, attachmentRef } from '../../../attachments/attachmentService'
import { isDesktop } from '../../../utils/platform'
import { toast } from 'sonner'
import { useWikilinkTooltip } from '../../../hooks/useWikilinkTooltip'
import { useWikilinkAutocomplete } from '../../../hooks/useWikilinkAutocomplete'
import { useEditorContextMenu } from '../../../hooks/useEditorContextMenu'
import { useEditorCommands } from './useEditorCommands'
import { ContextMenu } from '../../molecules/ContextMenu'
import { NotePreviewPopover } from '../../common/NotePreviewPopover'
import { WikilinkDropdown } from './WikilinkDropdown'
import { ChartTypeModal } from './ChartTypeModal'
import type { MarkdownEditorProps } from '../../../types'

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

export function MarkdownEditor({ noteId, initialMarkdown, readOnly = false, onChange, onWikilinkClick, enableAttachments }: MarkdownEditorProps): JSX.Element {
  const rootRef              = useRef<HTMLDivElement | null>(null)
  const crepeRef             = useRef<Crepe | null>(null)
  const editorReadyRef       = useRef(false)
  const prevNoteIdRef        = useRef(noteId)
  const initialMarkdownRef   = useRef(initialMarkdown)
  const pendingContentRef    = useRef<string | null>(null)
  const onChangeRef          = useRef(onChange)
  const onWikilinkClickRef   = useRef(onWikilinkClick)
  const readOnlyRef          = useRef(readOnly)
  const attachmentsRef       = useRef(enableAttachments)

  // Keep the flag current for the upload plugins (read at event time).
  useEffect(() => { attachmentsRef.current = enableAttachments }, [enableAttachments])

  const editorZoom    = useAppStore(s => s.editorZoom)
  const setEditorZoom = useAppStore(s => s.setEditorZoom)

  // Pinch-to-zoom (touch): two-finger gesture scales the editor content.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let startDist = 0
    let startZoom = 1
    const distance = (t: TouchList) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        startDist = distance(e.touches)
        startZoom = useAppStore.getState().editorZoom
      }
    }
    const onMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && startDist > 0) {
        e.preventDefault()
        setEditorZoom(startZoom * (distance(e.touches) / startDist))
      }
    }
    const onEnd = (e: TouchEvent) => { if (e.touches.length < 2) startDist = 0 }
    root.addEventListener('touchstart', onStart, { passive: true })
    root.addEventListener('touchmove', onMove, { passive: false })
    root.addEventListener('touchend', onEnd)
    return () => {
      root.removeEventListener('touchstart', onStart)
      root.removeEventListener('touchmove', onMove)
      root.removeEventListener('touchend', onEnd)
    }
  }, [setEditorZoom])

  useEffect(() => { onChangeRef.current = onChange }, [onChange])
  useEffect(() => { onWikilinkClickRef.current = onWikilinkClick }, [onWikilinkClick])

  useEffect(() => {
    readOnlyRef.current = readOnly
    if (!editorReadyRef.current || !crepeRef.current) return
    crepeRef.current.editor.action(ctx => {
      ctx.get(editorViewCtx).setProps({ editable: () => !readOnly })
    })
  }, [readOnly])

  const [chartModalOpen, setChartModalOpen] = useState(false)
  const navigate = useNavigate()

  const { tooltip, attach: attachTooltip, dismiss: dismissTooltip } = useWikilinkTooltip(rootRef)
  const { menu, handleContextMenu, resizeImage, closeMenu } = useEditorContextMenu(crepeRef, rootRef)
  const { ac, suggestions, complete, dismiss: dismissAc } = useWikilinkAutocomplete(crepeRef, rootRef)
  const cmds = useEditorCommands(crepeRef, closeMenu, () => setChartModalOpen(true))

  useEffect(() => {
    const h = () => setChartModalOpen(true)
    window.addEventListener('mv:open-chart-modal', h)
    return () => window.removeEventListener('mv:open-chart-modal', h)
  }, [])

  // When "/" is the only char and editor regains focus, ping cursor to force slash menu re-trigger
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const onFocus = () => {
      const crepe = crepeRef.current
      if (!crepe || !editorReadyRef.current) return
      crepe.editor.action(ctx => {
        const view = ctx.get(editorViewCtx)
        const { state } = view
        const { $from } = state.selection
        if ($from.parent.type.name !== 'paragraph') return
        if ($from.parent.textContent !== '/') return
        const end   = state.selection.from
        const start = $from.start($from.depth)
        if (end === start) return
        view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, start)))
        view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, end)))
      })
    }
    root.addEventListener('focusin', onFocus)
    return () => root.removeEventListener('focusin', onFocus)
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const path = (e as CustomEvent<{ path: string }>).detail?.path
      if (path) navigate(path)
    }
    window.addEventListener('mv:navigate', handler)
    return () => window.removeEventListener('mv:navigate', handler)
  }, [navigate])

  useEffect(() => {
    if (prevNoteIdRef.current === noteId) return
    prevNoteIdRef.current = noteId
    if (crepeRef.current && editorReadyRef.current) {
      crepeRef.current.editor.action(replaceAll(initialMarkdown))
    } else {
      pendingContentRef.current = initialMarkdown
    }
  }, [noteId, initialMarkdown])

  useEffect(() => {
    if (!menu.visible) return
    const close = () => closeMenu()
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [menu.visible, closeMenu])

  useEffect(() => {
    if (!rootRef.current) return
    const fileToDataURL = (file: File): Promise<string> =>
      new Promise((resolve, reject) => {
        if (!assertUploadSize(file.size, file.name)) {
          reject(new Error('File exceeds plan limit'))
          return
        }
        const reader = new FileReader()
        reader.onload  = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

    // When attachments are enabled, imported media becomes a standalone file
    // referenced by attachment://<id>; otherwise (e.g. kanban) inline base64.
    const handleUpload = async (file: File): Promise<string> => {
      if (attachmentsRef.current) {
        const rec = await importAttachment(file)
        if (!rec) throw new Error('File rejected')
        return attachmentRef(rec.id)
      }
      return fileToDataURL(file)
    }

    const crepe = new Crepe({
      root: rootRef.current,
      defaultValue: initialMarkdownRef.current,
      features: { [Crepe.Feature.Toolbar]: false },
      featureConfigs: {
        [Crepe.Feature.ImageBlock]: { onUpload: handleUpload },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [Crepe.Feature.BlockEdit]: { buildMenu: (builder: any) => {
          try {
            const group = builder.getGroup('advanced')
            group.addItem('chart', {
              label: 'Chart',
              icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>',
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onRun: (_ctx: any) => { window.dispatchEvent(new Event('mv:open-chart-modal')) },
            })
          } catch {
            // 'advanced' group unavailable — chart still accessible via right-click
          }
        } },
      },
    })
    crepeRef.current = crepe
    crepe.editor.use(wikilinkHighlightPlugin)
    crepe.editor.use(calloutPlugin)
    crepe.editor.use(linkInputRulePlugin)
    crepe.editor.use(linkKeymapPlugin)
    crepe.editor.use(math)
    crepe.editor.use(pasteSanitizePlugin)
    crepe.editor.use(imageLazyPlugin)
    crepe.editor.use(attachmentRenderPlugin())
    crepe.editor.use(queryBlockPlugin)
    crepe.editor.use(chartCodeBlockPlugin)
    crepe.editor.use(mobileAddBlockPlugin)
    crepe.editor.use(mobileListToolbarPlugin)
    crepe.editor.use(clickBelowAppendPlugin)
    crepe.on(listener => { listener.markdownUpdated((_ctx, md) => onChangeRef.current(md)) })

    void crepe.create().then(() => {
      editorReadyRef.current = true
      if (pendingContentRef.current !== null) {
        crepe.editor.action(replaceAll(pendingContentRef.current))
        pendingContentRef.current = null
      }
      if (readOnlyRef.current) {
        crepe.editor.action(ctx => {
          ctx.get(editorViewCtx).setProps({ editable: () => false })
        })
      }
    })

    const detachTooltip = attachTooltip()
    return () => {
      detachTooltip?.()
      crepeRef.current       = null
      editorReadyRef.current = false
      void crepe.destroy()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Drag-drop / paste of any file (image, video, audio, pdf, xlsx, csv, …):
  // import it as an attachment and insert a node carrying the attachment:// ref.
  // Dropped files always go through here; image *paste* is left to Crepe.
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
    const filesFromUris = async (uris: string[]): Promise<File[]> => {
      const { readFile } = await import('@tauri-apps/plugin-fs')
      const out: File[] = []
      for (const uri of uris) {
        try {
          const path = decodeURIComponent(uri.replace(/^file:\/\//, ''))
          const bytes = await readFile(path)
          const name = path.split(/[/\\]/).pop() ?? 'file'
          out.push(new File([bytes as BlobPart], name, { type: mimeForFile(name) }))
        } catch { /* skip unreadable path */ }
      }
      return out
    }

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
        void runImport(() => filesFromUris(uris))
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
            void runImport(async () => {
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
            })
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
  }, [])

  async function handleLinkClick(e: React.MouseEvent<HTMLDivElement>) {
    const anchor = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null
    if (!anchor) return
    const href = anchor.getAttribute('href')
    if (!href) return
    e.preventDefault()
    e.stopPropagation()
    try {
      const { open } = await import('@tauri-apps/plugin-shell')
      await open(href)
    } catch {
      window.open(href, '_blank', 'noopener,noreferrer')
    }
  }

  function insertChartBlock(template: string) {
    crepeRef.current?.editor.action(ctx => {
      const view = ctx.get(editorViewCtx)
      const { state } = view
      const codeBlock = state.schema.nodes['code_block']
      if (!codeBlock) return
      const block = codeBlock.create({ language: 'chart' }, state.schema.text(template))
      view.dispatch(state.tr.replaceSelectionWith(block).scrollIntoView())
      view.focus()
    })
  }

  return (
    <div
      className="relative h-full min-h-[320px]"
      data-readonly={readOnly || undefined}
      onContextMenu={readOnly ? undefined : handleContextMenu}
      onClick={handleLinkClick}
      style={{ '--editor-zoom': editorZoom } as React.CSSProperties}
    >
      <div ref={rootRef} className="h-full min-h-[320px]" />

      {ac.visible && (
        <WikilinkDropdown
          x={ac.x} y={ac.y} query={ac.query}
          suggestions={suggestions}
          isTransclusion={ac.isTransclusion}
          onSelect={complete}
          onDismiss={dismissAc}
        />
      )}

      {tooltip.visible && (
        <NotePreviewPopover
          title={tooltip.title} x={tooltip.x} y={tooltip.y}
          onNavigate={() => onWikilinkClickRef.current?.(tooltip.title)}
          onClose={dismissTooltip}
        />
      )}

      {chartModalOpen && (
        <ChartTypeModal
          onInsert={insertChartBlock}
          onClose={() => setChartModalOpen(false)}
        />
      )}

      {menu.visible && (
        <ContextMenu
          x={menu.x} y={menu.y} kind={menu.kind} rowIndex={menu.rowIndex} colIndex={menu.colIndex}
          selectedText={menu.selectedText}
          onAddColBefore={() => cmds.onAddColBefore(menu.colIndex)}
          onAddColAfter={() => cmds.onAddColAfter(menu.colIndex)}
          onRemoveCol={() => cmds.onRemoveCol(menu.colIndex)}
          onAddRowBefore={() => cmds.onAddRowBefore(menu.rowIndex)}
          onAddRowAfter={() => cmds.onAddRowAfter(menu.rowIndex)}
          onRemoveRow={() => cmds.onRemoveRow(menu.rowIndex)}
          onResizeImage={resizeImage}
          onBold={cmds.onBold}
          onItalic={cmds.onItalic}
          onInlineCode={cmds.onInlineCode}
          onStrikethrough={cmds.onStrikethrough}
          onClearFormatting={cmds.onClearFormatting}
          onBulletList={cmds.onBulletList}
          onOrderedList={cmds.onOrderedList}
          onTaskList={cmds.onTaskList}
          onBlockquote={cmds.onBlockquote}
          onInsertTable={cmds.onInsertTable}
          onInsertCallout={cmds.onInsertCallout}
          onInsertHr={cmds.onInsertHr}
          onInsertCodeBlock={cmds.onInsertCodeBlock}
          onInsertChart={cmds.onInsertChart}
          onHeading={cmds.onHeading}
          onTurnIntoText={cmds.onTurnIntoText}
          onAddLink={cmds.onAddLink}
          onAddExternalLink={cmds.onAddExternalLink}
          onCut={cmds.onCut}
          onCopy={cmds.onCopy}
          onPaste={cmds.onPaste}
          onSelectAll={cmds.onSelectAll}
        />
      )}
    </div>
  )
}
