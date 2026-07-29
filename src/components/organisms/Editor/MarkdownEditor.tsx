import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Crepe } from '@milkdown/crepe'
import { editorViewCtx } from '@milkdown/core'
import { isTouch } from '../../../utils/platform'
import { useWikilinkTooltip } from '../../../hooks/useWikilinkTooltip'
import { useWikilinkAutocomplete } from '../../../hooks/useWikilinkAutocomplete'
import { useSlashMenu } from '../../../hooks/useSlashMenu'
import { useEditorContextMenu } from '../../../hooks/useEditorContextMenu'
import { useEditorPinchZoom } from '../../../hooks/useEditorPinchZoom'
import { useCrepeEditor } from '../../../hooks/useCrepeEditor'
import { useEditorFileDrop } from '../../../hooks/useEditorFileDrop'
import { useEditorCommands } from './useEditorCommands'
import { ContextMenu } from '../../molecules/ContextMenu'
import { SlashMenu } from './SlashMenu'
import { NotePreviewPopover } from '../../common/NotePreviewPopover'
import { WikilinkDropdown } from './WikilinkDropdown'
import { ChartTypeModal } from './ChartTypeModal'
import type { MarkdownEditorProps } from '../../../types'

export function MarkdownEditor({ noteId, initialMarkdown, readOnly = false, onChange, onWikilinkClick, enableAttachments }: MarkdownEditorProps): JSX.Element {
  const rootRef            = useRef<HTMLDivElement | null>(null)
  const crepeRef           = useRef<Crepe | null>(null)
  const onWikilinkClickRef = useRef(onWikilinkClick)
  useEffect(() => { onWikilinkClickRef.current = onWikilinkClick }, [onWikilinkClick])

  const [chartModalOpen, setChartModalOpen] = useState(false)
  const navigate = useNavigate()

  const editorZoom = useEditorPinchZoom(rootRef)

  const { tooltip, attach: attachTooltip, dismiss: dismissTooltip } = useWikilinkTooltip(rootRef)
  const { menu, handleContextMenu, resizeImage, closeMenu } = useEditorContextMenu(crepeRef, rootRef)
  const { ac, suggestions, complete, dismiss: dismissAc } = useWikilinkAutocomplete(crepeRef, rootRef)
  const { slash, dismiss: dismissSlash, runCommand: runSlash } = useSlashMenu(crepeRef, rootRef)
  const cmds = useEditorCommands(crepeRef, closeMenu, () => setChartModalOpen(true))

  const attachmentsRef = useCrepeEditor({
    rootRef, crepeRef, noteId, initialMarkdown, readOnly, onChange, enableAttachments, attachTooltip,
  })
  useEditorFileDrop(rootRef, crepeRef, attachmentsRef)

  useEffect(() => {
    const h = () => setChartModalOpen(true)
    window.addEventListener('mv:open-chart-modal', h)
    return () => window.removeEventListener('mv:open-chart-modal', h)
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
      onContextMenu={readOnly || isTouch() ? undefined : handleContextMenu}
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

      {slash.visible && !ac.visible && (
        <SlashMenu
          x={slash.x} y={slash.y} query={slash.query}
          cmds={cmds}
          onRun={runSlash}
          onDismiss={dismissSlash}
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
          onAddTransclusion={cmds.onAddTransclusion}
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
