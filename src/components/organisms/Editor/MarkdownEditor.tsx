import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { queryBlockPlugin } from './queryBlockPlugin'
import { chartCodeBlockPlugin } from './chartCodeBlockPlugin'
import { useWikilinkTooltip } from '../../../hooks/useWikilinkTooltip'
import { useWikilinkAutocomplete } from '../../../hooks/useWikilinkAutocomplete'
import { useEditorContextMenu } from '../../../hooks/useEditorContextMenu'
import { useEditorCommands } from './useEditorCommands'
import { ContextMenu } from '../../molecules/ContextMenu'
import { NotePreviewPopover } from '../../common/NotePreviewPopover'
import { WikilinkDropdown } from './WikilinkDropdown'
import { ChartTypeModal, buildChartTemplate } from './ChartTypeModal'
import type { MarkdownEditorProps } from '../../../types'

export function MarkdownEditor({ noteId, initialMarkdown, noteTitle, readOnly = false, onChange, onWikilinkClick }: MarkdownEditorProps): JSX.Element {
  const rootRef              = useRef<HTMLDivElement | null>(null)
  const crepeRef             = useRef<Crepe | null>(null)
  const editorReadyRef       = useRef(false)
  const prevNoteIdRef        = useRef(noteId)
  const initialMarkdownRef   = useRef(initialMarkdown)
  const pendingContentRef    = useRef<string | null>(null)
  const onChangeRef          = useRef(onChange)
  const onWikilinkClickRef   = useRef(onWikilinkClick)
  const readOnlyRef          = useRef(readOnly)

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
        const reader = new FileReader()
        reader.onload  = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

    const crepe = new Crepe({
      root: rootRef.current,
      defaultValue: initialMarkdownRef.current,
      features: { [Crepe.Feature.Toolbar]: false },
      featureConfigs: {
        [Crepe.Feature.ImageBlock]: { onUpload: fileToDataURL },
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
    crepe.editor.use(queryBlockPlugin)
    crepe.editor.use(chartCodeBlockPlugin)
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
