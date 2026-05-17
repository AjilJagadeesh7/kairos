import { useEffect, useRef } from 'react'
import { Crepe } from '@milkdown/crepe'
import { commandsCtx, editorViewCtx } from '@milkdown/core'
import { replaceAll } from '@milkdown/utils'
import {
  addColAfterCommand, addColBeforeCommand, addRowAfterCommand, addRowBeforeCommand,
  deleteSelectedCellsCommand, insertTableCommand, selectColCommand, selectRowCommand,
  toggleStrikethroughCommand,
} from '@milkdown/preset-gfm'
import {
  toggleEmphasisCommand, toggleInlineCodeCommand, toggleStrongCommand,
  turnIntoTextCommand, wrapInHeadingCommand,
} from '@milkdown/preset-commonmark'
import { wikilinkHighlightPlugin } from './wikilinkPlugin'
import { useWikilinkTooltip } from '../../../hooks/useWikilinkTooltip'
import { useWikilinkAutocomplete } from '../../../hooks/useWikilinkAutocomplete'
import { useEditorContextMenu } from '../../../hooks/useEditorContextMenu'
import { ContextMenu } from '../../molecules/ContextMenu'
import { NotePreviewPopover } from '../../common/NotePreviewPopover'
import { WikilinkDropdown } from './WikilinkDropdown'
import type { MarkdownEditorProps, TableCommandRunner } from '../../../types'

export function MarkdownEditor({ noteId, initialMarkdown, noteTitle, notes, onChange, onWikilinkClick }: MarkdownEditorProps): JSX.Element {
  const rootRef              = useRef<HTMLDivElement | null>(null)
  const crepeRef             = useRef<Crepe | null>(null)
  const editorReadyRef       = useRef(false)
  const prevNoteIdRef        = useRef(noteId)
  const initialMarkdownRef   = useRef(initialMarkdown)
  const onChangeRef          = useRef(onChange)
  const onWikilinkClickRef   = useRef(onWikilinkClick)

  useEffect(() => { onChangeRef.current = onChange }, [onChange])
  useEffect(() => { onWikilinkClickRef.current = onWikilinkClick }, [onWikilinkClick])

  const { tooltip, attach: attachTooltip, dismiss: dismissTooltip } = useWikilinkTooltip(rootRef)
  const { menu, handleContextMenu, resizeImage, closeMenu } = useEditorContextMenu(crepeRef, rootRef)
  const { ac, suggestions, complete, dismiss: dismissAc } = useWikilinkAutocomplete(crepeRef, rootRef, notes)

  // Swap content without reinitialising Milkdown when active note changes
  useEffect(() => {
    if (prevNoteIdRef.current === noteId) return
    prevNoteIdRef.current = noteId
    if (crepeRef.current && editorReadyRef.current) crepeRef.current.editor.action(replaceAll(initialMarkdown))
  }, [noteId, initialMarkdown])

  // Close context menu on window events
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

  // Initialise Milkdown once
  useEffect(() => {
    if (!rootRef.current) return
    const fileToDataURL = (file: File): Promise<string> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload  = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

    const crepe = new Crepe({
      root: rootRef.current,
      defaultValue: initialMarkdownRef.current,
      featureConfigs: {
        [Crepe.Feature.ImageBlock]: { onUpload: fileToDataURL },
        [Crepe.Feature.Toolbar]:    { buildToolbar: buildHeadingToolbar },
      },
    })
    crepeRef.current = crepe
    crepe.editor.use(wikilinkHighlightPlugin)
    crepe.on(listener => { listener.markdownUpdated((_ctx, md) => onChangeRef.current(md)) })

    void crepe.create().then(() => { editorReadyRef.current = true })

    const detachTooltip = attachTooltip()

    return () => {
      detachTooltip?.()
      crepeRef.current       = null
      editorReadyRef.current = false
      void crepe.destroy()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function runCmd(run: (commands: TableCommandRunner) => void) {
    const crepe = crepeRef.current
    if (!crepe) return
    crepe.editor.action((ctx) => {
      run(ctx.get(commandsCtx) as unknown as TableCommandRunner)
      ctx.get(editorViewCtx).focus()
    })
    closeMenu()
  }

  return (
    <div className="relative h-full min-h-[320px]" onContextMenu={handleContextMenu}>
      <div ref={rootRef} className="h-full min-h-[320px]" />

      {ac.visible && (
        <WikilinkDropdown
          x={ac.x}
          y={ac.y}
          query={ac.query}
          suggestions={suggestions}
          onSelect={complete}
          onDismiss={dismissAc}
        />
      )}

      {tooltip.visible && (
        <NotePreviewPopover
          title={tooltip.title}
          x={tooltip.x}
          y={tooltip.y}
          onNavigate={() => onWikilinkClickRef.current?.(tooltip.title)}
          onClose={dismissTooltip}
        />
      )}

      {menu.visible && (
        <ContextMenu
          x={menu.x} y={menu.y} kind={menu.kind} rowIndex={menu.rowIndex} colIndex={menu.colIndex}
          onAddColBefore={() => runCmd(c => { c.call(selectColCommand.key, { index: Math.max(0, menu.colIndex) }); c.call(addColBeforeCommand.key) })}
          onAddColAfter={() => runCmd(c => { c.call(selectColCommand.key, { index: Math.max(0, menu.colIndex) }); c.call(addColAfterCommand.key) })}
          onRemoveCol={() => runCmd(c => { c.call(selectColCommand.key, { index: Math.max(0, menu.colIndex) }); c.call(deleteSelectedCellsCommand.key) })}
          onAddRowBefore={() => runCmd(c => { c.call(selectRowCommand.key, { index: Math.max(0, menu.rowIndex) }); c.call(addRowBeforeCommand.key) })}
          onAddRowAfter={() => runCmd(c => { c.call(selectRowCommand.key, { index: Math.max(0, menu.rowIndex) }); c.call(addRowAfterCommand.key) })}
          onRemoveRow={() => runCmd(c => { c.call(selectRowCommand.key, { index: Math.max(0, menu.rowIndex) }); c.call(deleteSelectedCellsCommand.key) })}
          onResizeImage={resizeImage}
          onBold={() => runCmd(c => c.call(toggleStrongCommand.key))}
          onItalic={() => runCmd(c => c.call(toggleEmphasisCommand.key))}
          onInlineCode={() => runCmd(c => c.call(toggleInlineCodeCommand.key))}
          onStrikethrough={() => runCmd(c => c.call(toggleStrikethroughCommand.key))}
          onInsertTable={() => runCmd(c => c.call(insertTableCommand.key, { row: 3, col: 3 }))}
          onHeading={(level) => runCmd(c => c.call(wrapInHeadingCommand.key, level))}
          onTurnIntoText={() => runCmd(c => c.call(turnIntoTextCommand.key))}
        />
      )}
    </div>
  )
}

// ── Toolbar builder extracted to keep MarkdownEditor lean ────────────────────
type Builder = { addGroup: (key: string, label: string) => { addItem: (key: string, item: unknown) => void } }

function buildHeadingToolbar(builder: Builder) {
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

  const hGroup = builder.addGroup('headings', 'Headings')
  hGroup.addItem('h1', mkH(1))
  hGroup.addItem('h2', mkH(2))
  hGroup.addItem('h3', mkH(3))

  const pGroup = builder.addGroup('paragraph', 'Paragraph')
  pGroup.addItem('text', {
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
}
