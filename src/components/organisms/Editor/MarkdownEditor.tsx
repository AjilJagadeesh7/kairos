import { useEffect, useRef, useState } from 'react'
import { Crepe } from '@milkdown/crepe'
import { commandsCtx, editorViewCtx } from '@milkdown/core'
import { replaceAll } from '@milkdown/utils'
import { $prose } from '@milkdown/utils'
import { Plugin, PluginKey } from '@milkdown/prose/state'
import { Decoration, DecorationSet } from '@milkdown/prose/view'
import { Selection } from '@milkdown/prose/state'
import {
  addColAfterCommand,
  addColBeforeCommand,
  addRowAfterCommand,
  addRowBeforeCommand,
  deleteSelectedCellsCommand,
  insertTableCommand,
  selectColCommand,
  selectRowCommand,
  toggleStrikethroughCommand,
} from '@milkdown/preset-gfm'
import {
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleStrongCommand,
  turnIntoTextCommand,
  wrapInHeadingCommand,
} from '@milkdown/preset-commonmark'
import { ContextMenu } from '../../molecules/ContextMenu'
import { NotePreviewPopover } from '../../common/NotePreviewPopover'
import type { ContextMenuState, MarkdownEditorProps, TableCommandRunner } from '../../../types'
import { CLOSED_MENU } from '../../../types'

// ── Wikilink regex used for decoration + click detection ──────────────────────
const WIKILINK_DECO_RE = /\[\[([^\]]+)\]\]/g

function buildWikilinkDecorations(
  doc: Parameters<typeof DecorationSet.create>[0],
): DecorationSet {
  const decos: Decoration[] = []
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    WIKILINK_DECO_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = WIKILINK_DECO_RE.exec(node.text)) !== null) {
      decos.push(
        Decoration.inline(
          pos + m.index,
          pos + m.index + m[0].length,
          { class: 'wikilink-token', nodeName: 'span' },
        ),
      )
    }
  })
  return DecorationSet.create(doc, decos)
}

const wikilinkHighlightPlugin = $prose(() => {
  const key = new PluginKey<DecorationSet>('wikilink-highlight')
  return new Plugin<DecorationSet>({
    key,
    state: {
      init: (_, { doc }) => buildWikilinkDecorations(doc),
      apply: (tr, old) => (tr.docChanged ? buildWikilinkDecorations(tr.doc) : old),
    },
    props: {
      decorations(state) { return key.getState(state) },
    },
  })
})

export function MarkdownEditor({ noteId, initialMarkdown, noteTitle, onChange, onWikilinkClick }: MarkdownEditorProps): JSX.Element {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const crepeRef = useRef<Crepe | null>(null)
  const editorReadyRef = useRef(false)
  const prevNoteIdRef = useRef(noteId)
  const initialMarkdownRef = useRef(initialMarkdown)
  const onChangeRef = useRef(onChange)
  const onWikilinkClickRef = useRef(onWikilinkClick)
  const noteTitleRef = useRef(noteTitle)
  const [menu, setMenu] = useState<ContextMenuState>(CLOSED_MENU)
  const [wikilinkTooltip, setWikilinkTooltip] = useState<{
    visible: boolean; title: string; x: number; y: number
  }>({ visible: false, title: '', x: 0, y: 0 })

  useEffect(() => { onChangeRef.current = onChange }, [onChange])
  useEffect(() => { onWikilinkClickRef.current = onWikilinkClick }, [onWikilinkClick])
  useEffect(() => { noteTitleRef.current = noteTitle }, [noteTitle])

  // When the active note changes, swap content in-place without reinitialising Milkdown
  useEffect(() => {
    if (prevNoteIdRef.current === noteId) return
    prevNoteIdRef.current = noteId
    const crepe = crepeRef.current
    if (!crepe || !editorReadyRef.current) return
    crepe.editor.action(replaceAll(initialMarkdown))
  }, [noteId, initialMarkdown])

  useEffect(() => {
    if (!menu.visible) return
    const onClose = () => setMenu(CLOSED_MENU)
    window.addEventListener('click', onClose)
    window.addEventListener('scroll', onClose, true)
    window.addEventListener('resize', onClose)
    return () => {
      window.removeEventListener('click', onClose)
      window.removeEventListener('scroll', onClose, true)
      window.removeEventListener('resize', onClose)
    }
  }, [menu.visible])

  useEffect(() => {
    if (!rootRef.current) return

    const fileToDataURL = (file: File): Promise<string> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

    const crepe = new Crepe({
      root: rootRef.current,
      defaultValue: initialMarkdownRef.current,
      featureConfigs: {
        [Crepe.Feature.ImageBlock]: {
          onUpload: fileToDataURL,
        },
        [Crepe.Feature.Toolbar]: {
          buildToolbar(builder: { addGroup: (key: string, label: string) => { addItem: (key: string, item: { icon: string; active: (ctx: unknown) => boolean; onRun: (ctx: unknown) => void }) => void } }) {
            // Add H1–H3 heading buttons as a new group in the selection toolbar
            const mkH = (level: 1 | 2 | 3) => ({
              icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><text x="12" y="17" text-anchor="middle" font-size="12" font-weight="700" fill="currentColor">H${level}</text></svg>`,
              active: (ctx: unknown) => {
                try {
                  const view = (ctx as { get: (s: unknown) => { state: { selection: { $from: { parent: { type: { name: string }; attrs: { level: number } } } } } } }).get(editorViewCtx)
                  const { $from } = view.state.selection
                  return $from.parent.type.name === 'heading' && $from.parent.attrs.level === level
                } catch { return false }
              },
              onRun: (ctx: unknown) => {
                (ctx as { get: (s: unknown) => { call: (k: unknown, p: unknown) => void } }).get(commandsCtx).call(wrapInHeadingCommand.key, level)
              },
            })
            const headingsGroup = builder.addGroup('headings', 'Headings')
            headingsGroup.addItem('h1', mkH(1))
            headingsGroup.addItem('h2', mkH(2))
            headingsGroup.addItem('h3', mkH(3))
            // "Normal text" — converts heading back to paragraph
            const paragraphGroup = builder.addGroup('paragraph', 'Paragraph')
            paragraphGroup.addItem('text', {
                icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><text x="12" y="17" text-anchor="middle" font-size="11" font-weight="400" fill="currentColor">¶</text></svg>`,
                active: (ctx: unknown) => {
                  try {
                    const view = (ctx as { get: (s: unknown) => { state: { selection: { $from: { parent: { type: { name: string } } } } } } }).get(editorViewCtx)
                    return view.state.selection.$from.parent.type.name === 'paragraph'
                  } catch { return false }
                },
                onRun: (ctx: unknown) => {
                  (ctx as { get: (s: unknown) => { call: (k: unknown) => void } }).get(commandsCtx).call(turnIntoTextCommand.key)
                },
              })
          },
        },
      },
    })
    crepeRef.current = crepe

    // Register wikilink highlight plugin before create
    crepe.editor.use(wikilinkHighlightPlugin)

    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown) => {
        onChangeRef.current(markdown)
      })
    })

    void crepe.create().then(() => {
      editorReadyRef.current = true
    })

    // Wikilink click: show tooltip instead of immediately navigating
    const handleWikilinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const token = target.closest('.wikilink-token') as HTMLElement | null
      if (!token) return
      const raw = token.textContent ?? ''
      const title = raw.replace(/^\[\[|\]\]$/g, '').trim()
      if (!title) return
      e.preventDefault()
      e.stopPropagation()
      const rect = token.getBoundingClientRect()
      setWikilinkTooltip({
        visible: true,
        title,
        x: rect.left + rect.width / 2,
        y: rect.bottom,
      })
    }

    rootRef.current.addEventListener('click', handleWikilinkClick)

    return () => {
      rootRef.current?.removeEventListener('click', handleWikilinkClick)
      crepeRef.current = null
      editorReadyRef.current = false
      void crepe.destroy()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const runCmd = (run: (commands: TableCommandRunner) => void) => {
    const crepe = crepeRef.current
    if (!crepe) return
    crepe.editor.action((ctx) => {
      run(ctx.get(commandsCtx) as unknown as TableCommandRunner)
      ctx.get(editorViewCtx).focus()
    })
    setMenu(CLOSED_MENU)
  }

  const resizeImage = (widthPx: number | null) => {
    const crepe = crepeRef.current
    if (!crepe || menu.imageNodePos < 0) { setMenu(CLOSED_MENU); return }
    const targetPos = menu.imageNodePos
    const storedSrc = menu.imageSrc
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const { state } = view
      // Resolve the stored position and walk up to find the actual image node.
      const $pos = state.doc.resolve(targetPos)
      let nodePos = -1
      for (let d = $pos.depth; d >= 0; d--) {
        const n = $pos.node(d)
        if (n.type.name === 'image' || n.type.name === 'image-block') {
          nodePos = $pos.before(d)
          break
        }
      }
      if (nodePos < 0) {
        const direct = state.doc.nodeAt(targetPos)
        if (direct && (direct.type.name === 'image' || direct.type.name === 'image-block')) {
          nodePos = targetPos
        }
      }
      if (nodePos < 0) { view.focus(); return }
      const node = state.doc.nodeAt(nodePos)
      if (!node) { view.focus(); return }

      // After a prior setNodeMarkup the node re-renders and the old imgEl is
      // detached from the DOM — naturalWidth/height and getBoundingClientRect()
      // return 0 on detached elements. Always look up the live <img> by src.
      const liveImg = rootRef.current?.querySelector<HTMLImageElement>(
        `img[src="${CSS.escape(storedSrc)}"]`
      ) ?? null

      let newRatio = 1
      if (liveImg && liveImg.naturalWidth > 0) {
        // Compute the full-width display height, mirroring Milkdown's onImageLoad.
        // Prefer the cached data-origin; recompute if absent (e.g. image re-mounted).
        let originHeight = Number(liveImg.dataset.origin)
        if (!(originHeight > 0)) {
          const host = liveImg.closest('.milkdown-image-block') as HTMLElement | null
          const containerWidth = host ? host.getBoundingClientRect().width : liveImg.getBoundingClientRect().width
          const maxWidth = containerWidth || liveImg.naturalWidth
          originHeight = liveImg.naturalWidth < maxWidth
            ? liveImg.naturalHeight
            : maxWidth * (liveImg.naturalHeight / liveImg.naturalWidth)
          liveImg.dataset.origin = originHeight.toFixed(2)
        }

        if (widthPx !== null) {
          const aspectRatio = liveImg.naturalHeight / liveImg.naturalWidth
          const desiredHeight = widthPx * aspectRatio
          newRatio = parseFloat((desiredHeight / originHeight).toFixed(2))
        }
        // Apply visual change immediately, mirrors Milkdown's own resize handle
        const displayHeight = originHeight * newRatio
        liveImg.dataset.height = displayHeight.toFixed(2)
        liveImg.style.height = `${displayHeight}px`
      }

      view.dispatch(state.tr.setNodeMarkup(nodePos, undefined, { ...node.attrs, ratio: newRatio }))
      view.focus()
    })
    setMenu(CLOSED_MENU)
  }

  const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    const crepe = crepeRef.current
    if (!crepe) return
    const target = event.target as HTMLElement
    if (!target.closest('.milkdown')) return
    event.preventDefault()

    let kind: ContextMenuState['kind'] = 'default'
    let imageSrc = ''
    let imageNodePos = -1
    let rowIndex = -1
    let colIndex = -1

    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })
      if (pos) {
        const tr = view.state.tr.setSelection(Selection.near(view.state.doc.resolve(pos.pos)))
        view.dispatch(tr)

        const node = view.state.doc.nodeAt(pos.pos)
        if (node && (node.type.name === 'image' || node.type.name === 'image-block')) {
          kind = 'image'
          imageSrc = node.attrs.src as string
          imageNodePos = pos.pos
        }
      }
      if (kind === 'default' && !view.state.selection.empty) {
        kind = 'text'
      }
      view.focus()
    })

    // Check for table cell
    const cell = target.closest('th, td') as HTMLTableCellElement | null
    if (cell) {
      const row = cell.parentElement as HTMLTableRowElement | null
      const table = row?.closest('table')
      rowIndex = row && table ? Array.from(table.querySelectorAll('tr')).indexOf(row) : -1
      colIndex = row ? Array.from(row.children).indexOf(cell) : -1
      kind = 'table'
    }

    // Check for image via DOM (fallback)
    const imgEl = target.tagName === 'IMG'
      ? (target as HTMLImageElement)
      : (target.closest('img') as HTMLImageElement | null)
    if (imgEl && kind !== 'table') {
      kind = 'image'
      imageSrc = imgEl.src
      // Resolve position: posAtDOM(imgEl, 0) lands inside the image-block node,
      // so we walk up the depth stack to get the node's own start position.
      crepe.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        const rawPos = view.posAtDOM(imgEl, 0)
        const $p = view.state.doc.resolve(rawPos)
        for (let d = $p.depth; d >= 0; d--) {
          const n = $p.node(d)
          if (n.type.name === 'image' || n.type.name === 'image-block') {
            imageNodePos = $p.before(d)
            break
          }
        }
        if (imageNodePos < 0) imageNodePos = rawPos
      })
    }

    setMenu({ visible: true, x: event.clientX, y: event.clientY, kind, rowIndex, colIndex, imageSrc, imageNodePos })
  }

  return (
    <div className="relative h-full min-h-[320px]" onContextMenu={handleContextMenu}>
      <div ref={rootRef} className="h-full min-h-[320px]" />

      {wikilinkTooltip.visible && (
        <NotePreviewPopover
          title={wikilinkTooltip.title}
          x={wikilinkTooltip.x}
          y={wikilinkTooltip.y}
          onNavigate={() => onWikilinkClickRef.current?.(wikilinkTooltip.title)}
          onClose={() => setWikilinkTooltip((s) => ({ ...s, visible: false }))}
        />
      )}

      {menu.visible && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          kind={menu.kind}
          rowIndex={menu.rowIndex}
          colIndex={menu.colIndex}
          onAddColBefore={() => runCmd((c) => { c.call(selectColCommand.key, { index: Math.max(0, menu.colIndex) }); c.call(addColBeforeCommand.key) })}
          onAddColAfter={() => runCmd((c) => { c.call(selectColCommand.key, { index: Math.max(0, menu.colIndex) }); c.call(addColAfterCommand.key) })}
          onRemoveCol={() => runCmd((c) => { c.call(selectColCommand.key, { index: Math.max(0, menu.colIndex) }); c.call(deleteSelectedCellsCommand.key) })}
          onAddRowBefore={() => runCmd((c) => { c.call(selectRowCommand.key, { index: Math.max(0, menu.rowIndex) }); c.call(addRowBeforeCommand.key) })}
          onAddRowAfter={() => runCmd((c) => { c.call(selectRowCommand.key, { index: Math.max(0, menu.rowIndex) }); c.call(addRowAfterCommand.key) })}
          onRemoveRow={() => runCmd((c) => { c.call(selectRowCommand.key, { index: Math.max(0, menu.rowIndex) }); c.call(deleteSelectedCellsCommand.key) })}
          onResizeImage={resizeImage}
          onBold={() => runCmd((c) => c.call(toggleStrongCommand.key))}
          onItalic={() => runCmd((c) => c.call(toggleEmphasisCommand.key))}
          onInlineCode={() => runCmd((c) => c.call(toggleInlineCodeCommand.key))}
          onStrikethrough={() => runCmd((c) => c.call(toggleStrikethroughCommand.key))}
          onInsertTable={() => runCmd((c) => c.call(insertTableCommand.key, { row: 3, col: 3 }))}
          onHeading={(level) => runCmd((c) => c.call(wrapInHeadingCommand.key, level))}
          onTurnIntoText={() => runCmd((c) => c.call(turnIntoTextCommand.key))}
        />
      )}
    </div>
  )
}
