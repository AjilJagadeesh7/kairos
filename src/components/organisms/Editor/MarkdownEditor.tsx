import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Crepe } from '@milkdown/crepe'
import { commandsCtx, editorViewCtx } from '@milkdown/core'
import { TextSelection } from '@milkdown/prose/state'
import { replaceAll } from '@milkdown/utils'
import {
  addColAfterCommand, addColBeforeCommand, addRowAfterCommand, addRowBeforeCommand,
  deleteSelectedCellsCommand, insertTableCommand, selectColCommand, selectRowCommand,
  toggleStrikethroughCommand,
} from '@milkdown/preset-gfm'
import {
  toggleEmphasisCommand, toggleInlineCodeCommand, toggleStrongCommand,
  turnIntoTextCommand, wrapInHeadingCommand,
  wrapInBulletListCommand, wrapInOrderedListCommand, wrapInBlockquoteCommand,
  createCodeBlockCommand, insertHrCommand,
} from '@milkdown/preset-commonmark'
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
import { ContextMenu } from '../../molecules/ContextMenu'
import { NotePreviewPopover } from '../../common/NotePreviewPopover'
import { WikilinkDropdown } from './WikilinkDropdown'
import type { MarkdownEditorProps, TableCommandRunner } from '../../../types'

export function MarkdownEditor({ noteId, initialMarkdown, noteTitle, readOnly = false, onChange, onWikilinkClick }: MarkdownEditorProps): JSX.Element {
  const rootRef              = useRef<HTMLDivElement | null>(null)
  const crepeRef             = useRef<Crepe | null>(null)
  const editorReadyRef       = useRef(false)
  const prevNoteIdRef        = useRef(noteId)
  const initialMarkdownRef   = useRef(initialMarkdown)
  const pendingContentRef    = useRef<string | null>(null)  // content waiting for editor ready
  const onChangeRef          = useRef(onChange)
  const onWikilinkClickRef   = useRef(onWikilinkClick)
  const readOnlyRef          = useRef(readOnly)

  useEffect(() => { onChangeRef.current = onChange }, [onChange])
  useEffect(() => { onWikilinkClickRef.current = onWikilinkClick }, [onWikilinkClick])

  // Sync readOnly changes after the editor is ready
  useEffect(() => {
    readOnlyRef.current = readOnly
    if (!editorReadyRef.current || !crepeRef.current) return
    crepeRef.current.editor.action(ctx => {
      ctx.get(editorViewCtx).setProps({ editable: () => !readOnly })
    })
  }, [readOnly])

  const navigate = useNavigate()

  const { tooltip, attach: attachTooltip, dismiss: dismissTooltip } = useWikilinkTooltip(rootRef)
  const { menu, handleContextMenu, resizeImage, closeMenu } = useEditorContextMenu(crepeRef, rootRef)
  const { ac, suggestions, complete, dismiss: dismissAc } = useWikilinkAutocomplete(crepeRef, rootRef)

  // Handle navigation events dispatched from TransclusionEmbed widgets (outside React tree)
  useEffect(() => {
    const handler = (e: Event) => {
      const path = (e as CustomEvent<{ path: string }>).detail?.path
      if (path) navigate(path)
    }
    window.addEventListener('mv:navigate', handler)
    return () => window.removeEventListener('mv:navigate', handler)
  }, [navigate])

  // Swap content without reinitialising Milkdown when active note changes
  useEffect(() => {
    if (prevNoteIdRef.current === noteId) return
    prevNoteIdRef.current = noteId
    if (crepeRef.current && editorReadyRef.current) {
      crepeRef.current.editor.action(replaceAll(initialMarkdown))
    } else {
      // Editor still initialising — queue the content so it's applied on ready
      pendingContentRef.current = initialMarkdown
    }
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
      features: {
        [Crepe.Feature.Toolbar]: false,
      },
      featureConfigs: {
        [Crepe.Feature.ImageBlock]: { onUpload: fileToDataURL },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [Crepe.Feature.BlockEdit]: { buildMenu: (builder: any) => {
          const group = builder.getGroup('advanced')
          if (!group) return
          const chartTemplate = [
            'type: bar', 'title: My Chart',
            'labels: [Jan, Feb, Mar, Apr, May]',
            'datasets:', '  - label: Series 1',
            '    data: [10, 20, 15, 25, 18]', '    color: "#6366f1"',
          ].join('\n')
          group.addItem('chart', {
            label: 'Chart',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onRun: (ctx: any) => {
              const view = ctx.get(editorViewCtx)
              const { state } = view
              const codeBlock = state.schema.nodes['code_block']
              if (!codeBlock) return
              const block = codeBlock.create({ language: 'chart' }, state.schema.text(chartTemplate))
              view.dispatch(state.tr.replaceSelectionWith(block).scrollIntoView())
              view.focus()
            },
          })
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
      // Flush any content update that arrived before the editor was ready
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

  function runCmd(run: (commands: TableCommandRunner) => void) {
    const crepe = crepeRef.current
    if (!crepe) return
    try {
      crepe.editor.action((ctx) => {
        run(ctx.get(commandsCtx) as unknown as TableCommandRunner)
        ctx.get(editorViewCtx).focus()
      })
    } catch (err) {
      console.warn('[MindVault] Editor command failed:', err)
    }
    closeMenu()
  }

  function editorExec(cmd: string) {
    crepeRef.current?.editor.action(ctx => { ctx.get(editorViewCtx).focus() })
    document.execCommand(cmd)
    closeMenu()
  }

  function handlePaste() {
    closeMenu()
    const crepe = crepeRef.current
    if (!crepe) return

    function dispatchPaste(text: string) {
      if (!text) return
      const dt = new DataTransfer()
      dt.setData('text/plain', text)
      const event = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })
      crepe.editor.action(ctx => { ctx.get(editorViewCtx).dom.dispatchEvent(event) })
    }

    // Tauri native clipboard bypasses WebView isolation (works for system clipboard)
    import('@tauri-apps/plugin-clipboard-manager')
      .then(({ readText }) => readText())
      .then(dispatchPaste)
      .catch(() => {
        // Fallback for web/PWA: browser clipboard API
        navigator.clipboard.readText().then(dispatchPaste).catch(() => {
          crepe.editor.action(ctx => { ctx.get(editorViewCtx).focus() })
        })
      })
  }

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
          x={ac.x}
          y={ac.y}
          query={ac.query}
          suggestions={suggestions}
          isTransclusion={ac.isTransclusion}
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
          selectedText={menu.selectedText}
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
          onClearFormatting={() => {
            crepeRef.current?.editor.action(ctx => {
              const view = ctx.get(editorViewCtx)
              const { state } = view
              const { from, to } = state.selection
              // Remove every mark type in one transaction
              const tr = Object.values(state.schema.marks).reduce(
                (t, markType) => t.removeMark(from, to, markType),
                state.tr,
              )
              view.dispatch(tr)
              view.focus()
            })
            closeMenu()
          }}
          onBulletList={() => runCmd(c => c.call(wrapInBulletListCommand.key))}
          onOrderedList={() => runCmd(c => c.call(wrapInOrderedListCommand.key))}
          onTaskList={() => {
            crepeRef.current?.editor.action(ctx => {
              const view = ctx.get(editorViewCtx)
              const { state } = view
              const nodes = state.schema.nodes
              const para = nodes['paragraph'].create()
              const item = nodes['list_item'].create({ checked: false, listType: 'bullet', label: '•', spread: 'false' }, para)
              const list = nodes['bullet_list'].create(null, item)
              view.dispatch(state.tr.replaceSelectionWith(list).scrollIntoView())
              view.focus()
            })
            closeMenu()
          }}
          onBlockquote={() => runCmd(c => c.call(wrapInBlockquoteCommand.key))}
          onInsertTable={() => runCmd(c => c.call(insertTableCommand.key, { row: 3, col: 3 }))}
          onInsertCallout={() => {
            crepeRef.current?.editor.action(ctx => {
              const view = ctx.get(editorViewCtx)
              const { state } = view
              const nodes = state.schema.nodes
              const titleText = state.schema.text('[!NOTE]')
              const titlePara = nodes['paragraph'].create(null, titleText)
              const bodyPara  = nodes['paragraph'].create(null, state.schema.text('Callout content'))
              const bq = nodes['blockquote'].create(null, [titlePara, bodyPara])
              view.dispatch(state.tr.replaceSelectionWith(bq).scrollIntoView())
              view.focus()
            })
            closeMenu()
          }}
          onInsertHr={() => runCmd(c => c.call(insertHrCommand.key))}
          onInsertCodeBlock={() => runCmd(c => c.call(createCodeBlockCommand.key))}
          onInsertChart={() => {
            crepeRef.current?.editor.action(ctx => {
              const view  = ctx.get(editorViewCtx)
              const { state } = view
              const codeBlock = state.schema.nodes['code_block']
              if (!codeBlock) return
              const template = [
                'type: bar',
                'title: My Chart',
                'labels: [Jan, Feb, Mar, Apr, May]',
                'datasets:',
                '  - label: Series 1',
                '    data: [10, 20, 15, 25, 18]',
                '    color: "#6366f1"',
              ].join('\n')
              const block = codeBlock.create({ language: 'chart' }, state.schema.text(template))
              view.dispatch(state.tr.replaceSelectionWith(block).scrollIntoView())
              view.focus()
            })
            closeMenu()
          }}
          onHeading={(level) => runCmd(c => c.call(wrapInHeadingCommand.key, level))}
          onTurnIntoText={() => runCmd(c => c.call(turnIntoTextCommand.key))}
          onAddLink={() => {
            crepeRef.current?.editor.action(ctx => {
              const view = ctx.get(editorViewCtx)
              view.dispatch(view.state.tr.insertText('[['))
              view.focus()
            })
            closeMenu()
          }}
          onAddExternalLink={() => {
            crepeRef.current?.editor.action(ctx => {
              const view = ctx.get(editorViewCtx)
              const { state } = view
              const { from } = state.selection
              // Insert []() and place cursor inside [] so user types display text first
              const tr = state.tr.insertText('[]()')
              const cursorPos = from + 1   // position between [ and ]
              tr.setSelection(TextSelection.create(tr.doc, cursorPos))
              view.dispatch(tr.scrollIntoView())
              view.focus()
            })
            closeMenu()
          }}
          onCut={() => editorExec('cut')}
          onCopy={() => editorExec('copy')}
          onPaste={handlePaste}
          onSelectAll={() => editorExec('selectAll')}
        />
      )}
    </div>
  )
}


