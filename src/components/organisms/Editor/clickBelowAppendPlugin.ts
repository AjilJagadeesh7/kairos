import { Plugin, PluginKey, TextSelection } from '@milkdown/prose/state'
import { type EditorView } from '@milkdown/prose/view'
import { $prose } from '@milkdown/utils'

// Clicking (or tapping) the empty space below the last block should always
// start a new line there. ProseMirror's default click handling maps the click
// to the nearest text position, which fails when the document ends in a
// non-text block — e.g. a transclusion widget (`![[note]]`), whose raw text is
// display:none and whose widget is user-select:none — leaving the click dead.
//
// This plugin intercepts mousedown on the editor's own padding area (target is
// view.dom itself, below the last block's bottom edge): if the doc already
// ends in an empty paragraph the caret moves there, otherwise a fresh trailing
// paragraph is appended and focused. Touch taps reach this via the browser's
// synthesized mousedown, so the same path serves mobile.

const clickBelowAppendKey = new PluginKey('mvClickBelowAppend')

function placeCaretAtTrailingParagraph(view: EditorView) {
  const { state } = view
  const paragraph = state.schema.nodes.paragraph
  if (!paragraph) return

  const last = state.doc.lastChild
  const end = state.doc.content.size

  if (last && last.type === paragraph && last.content.size === 0) {
    const sel = TextSelection.near(state.doc.resolve(end), -1)
    view.dispatch(state.tr.setSelection(sel).scrollIntoView())
  } else {
    let tr = state.tr.insert(end, paragraph.create())
    tr = tr.setSelection(TextSelection.near(tr.doc.resolve(end + 1))).scrollIntoView()
    view.dispatch(tr)
  }
  view.focus()
}

export const clickBelowAppendPlugin = $prose(() => {
  return new Plugin({
    key: clickBelowAppendKey,
    props: {
      handleDOMEvents: {
        mousedown(view, event) {
          if (!view.editable) return false
          // Only clicks on the editor's own empty space — never on content.
          if (event.target !== view.dom) return false
          const lastBlock = view.dom.lastElementChild
          if (lastBlock && event.clientY <= lastBlock.getBoundingClientRect().bottom) return false
          event.preventDefault()
          placeCaretAtTrailingParagraph(view)
          return true
        },
      },
    },
  })
})
