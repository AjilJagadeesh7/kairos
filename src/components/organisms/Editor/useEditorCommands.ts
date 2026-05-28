import type { RefObject } from 'react'
import type { Crepe } from '@milkdown/crepe'
import { commandsCtx, editorViewCtx } from '@milkdown/core'
import { TextSelection } from '@milkdown/prose/state'
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
import type { TableCommandRunner } from '../../../types'

export interface EditorCommandHandlers {
  onBold: () => void
  onItalic: () => void
  onInlineCode: () => void
  onStrikethrough: () => void
  onClearFormatting: () => void
  onBulletList: () => void
  onOrderedList: () => void
  onTaskList: () => void
  onBlockquote: () => void
  onHeading: (level: number) => void
  onTurnIntoText: () => void
  onInsertTable: () => void
  onInsertCallout: () => void
  onInsertHr: () => void
  onInsertCodeBlock: () => void
  onInsertChart: () => void
  onAddLink: () => void
  onAddExternalLink: () => void
  onAddColBefore: (colIndex: number) => void
  onAddColAfter: (colIndex: number) => void
  onRemoveCol: (colIndex: number) => void
  onAddRowBefore: (rowIndex: number) => void
  onAddRowAfter: (rowIndex: number) => void
  onRemoveRow: (rowIndex: number) => void
  onCut: () => void
  onCopy: () => void
  onPaste: () => void
  onSelectAll: () => void
}

export function useEditorCommands(
  crepeRef: RefObject<Crepe>,
  closeMenu: () => void,
  onOpenChartModal: () => void,
): EditorCommandHandlers {
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
    const liveCrepe = crepe
    function dispatchPaste(text: string) {
      if (!text) return
      const dt = new DataTransfer()
      dt.setData('text/plain', text)
      const event = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })
      liveCrepe.editor.action(ctx => { ctx.get(editorViewCtx).dom.dispatchEvent(event) })
    }
    import('@tauri-apps/plugin-clipboard-manager')
      .then(({ readText }) => readText())
      .then(dispatchPaste)
      .catch(() => {
        navigator.clipboard.readText().then(dispatchPaste).catch(() => {
          liveCrepe.editor.action(ctx => { ctx.get(editorViewCtx).focus() })
        })
      })
  }

  return {
    onBold:         () => runCmd(c => c.call(toggleStrongCommand.key)),
    onItalic:       () => runCmd(c => c.call(toggleEmphasisCommand.key)),
    onInlineCode:   () => runCmd(c => c.call(toggleInlineCodeCommand.key)),
    onStrikethrough:() => runCmd(c => c.call(toggleStrikethroughCommand.key)),
    onBulletList:   () => runCmd(c => c.call(wrapInBulletListCommand.key)),
    onOrderedList:  () => runCmd(c => c.call(wrapInOrderedListCommand.key)),
    onBlockquote:   () => runCmd(c => c.call(wrapInBlockquoteCommand.key)),
    onInsertHr:     () => runCmd(c => c.call(insertHrCommand.key)),
    onInsertCodeBlock: () => runCmd(c => c.call(createCodeBlockCommand.key)),
    onTurnIntoText: () => runCmd(c => c.call(turnIntoTextCommand.key)),
    onHeading:      (level) => runCmd(c => c.call(wrapInHeadingCommand.key, level)),
    onInsertTable:  () => runCmd(c => c.call(insertTableCommand.key, { row: 3, col: 3 })),
    onAddColBefore: (colIndex) => runCmd(c => { c.call(selectColCommand.key, { index: Math.max(0, colIndex) }); c.call(addColBeforeCommand.key) }),
    onAddColAfter:  (colIndex) => runCmd(c => { c.call(selectColCommand.key, { index: Math.max(0, colIndex) }); c.call(addColAfterCommand.key) }),
    onRemoveCol:    (colIndex) => runCmd(c => { c.call(selectColCommand.key, { index: Math.max(0, colIndex) }); c.call(deleteSelectedCellsCommand.key) }),
    onAddRowBefore: (rowIndex) => runCmd(c => { c.call(selectRowCommand.key, { index: Math.max(0, rowIndex) }); c.call(addRowBeforeCommand.key) }),
    onAddRowAfter:  (rowIndex) => runCmd(c => { c.call(selectRowCommand.key, { index: Math.max(0, rowIndex) }); c.call(addRowAfterCommand.key) }),
    onRemoveRow:    (rowIndex) => runCmd(c => { c.call(selectRowCommand.key, { index: Math.max(0, rowIndex) }); c.call(deleteSelectedCellsCommand.key) }),
    onCut:          () => editorExec('cut'),
    onCopy:         () => editorExec('copy'),
    onPaste:        handlePaste,
    onSelectAll:    () => editorExec('selectAll'),
    onInsertChart:  () => { onOpenChartModal(); closeMenu() },

    onClearFormatting: () => {
      crepeRef.current?.editor.action(ctx => {
        const view = ctx.get(editorViewCtx)
        const { state } = view
        const { from, to } = state.selection
        const tr = Object.values(state.schema.marks).reduce(
          (t, markType) => t.removeMark(from, to, markType),
          state.tr,
        )
        view.dispatch(tr)
        view.focus()
      })
      closeMenu()
    },

    onTaskList: () => {
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
    },

    onInsertCallout: () => {
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
    },

    onAddLink: () => {
      crepeRef.current?.editor.action(ctx => {
        const view = ctx.get(editorViewCtx)
        view.dispatch(view.state.tr.insertText('[['))
        view.focus()
      })
      closeMenu()
    },

    onAddExternalLink: () => {
      crepeRef.current?.editor.action(ctx => {
        const view = ctx.get(editorViewCtx)
        const { state } = view
        const { from } = state.selection
        const tr = state.tr.insertText('[]()')
        const cursorPos = from + 1
        tr.setSelection(TextSelection.create(tr.doc, cursorPos))
        view.dispatch(tr.scrollIntoView())
        view.focus()
      })
      closeMenu()
    },
  }
}
