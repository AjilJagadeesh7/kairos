import { Plugin, PluginKey, type EditorState } from '@milkdown/prose/state'
import { type EditorView } from '@milkdown/prose/view'
import { sinkListItem, liftListItem } from '@milkdown/prose/schema-list'
import { $prose } from '@milkdown/utils'
import { isTouch } from '../../../utils/platform'

// Mobile keyboards have no Tab key, so list items can't be indented/outdented
// the way they are on desktop. This plugin renders a thin formatting bar pinned
// just above the on-screen keyboard (à la Notion / Bear / Apple Notes) with
// outdent / indent buttons that drive the same sink/lift list commands Tab and
// Shift-Tab trigger on desktop.
//
// The bar lives OUTSIDE the contenteditable (appended to document.body, fixed
// position) so it never interferes with native tap-to-place-caret, and it is
// positioned above the keyboard via the visualViewport API. Buttons use
// pointerdown + preventDefault to keep the editor selection (and the keyboard)
// alive while tapping. Shown only on coarse-pointer devices, while editable and
// focused with the keyboard open.

const mobileListToolbarKey = new PluginKey('mvMobileListToolbar')

// lucide indent-decrease / indent-increase
const OUTDENT_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" width="20" height="20">' +
  '<polyline points="7 8 3 12 7 16"/><line x1="21" y1="6" x2="11" y2="6"/>' +
  '<line x1="21" y1="12" x2="11" y2="12"/><line x1="21" y1="18" x2="11" y2="18"/></svg>'
const INDENT_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" width="20" height="20">' +
  '<polyline points="3 8 7 12 3 16"/><line x1="21" y1="6" x2="11" y2="6"/>' +
  '<line x1="21" y1="12" x2="11" y2="12"/><line x1="21" y1="18" x2="11" y2="18"/></svg>'

type ListAction = 'indent' | 'outdent'

function listCommand(state: EditorState, action: ListAction) {
  const itemType = state.schema.nodes.list_item
  if (!itemType) return null
  return action === 'indent' ? sinkListItem(itemType) : liftListItem(itemType)
}

// Without a dispatch, ProseMirror list commands return whether they would apply.
function canRun(state: EditorState, action: ListAction): boolean {
  const cmd = listCommand(state, action)
  return cmd ? cmd(state) : false
}

function runList(view: EditorView, action: ListAction) {
  const cmd = listCommand(view.state, action)
  if (!cmd) return
  cmd(view.state, view.dispatch)
  view.focus()
}

export const mobileListToolbarPlugin = $prose(() => {
  return new Plugin({
    key: mobileListToolbarKey,
    view(view) {
      if (!isTouch()) return {}

      const bar = document.createElement('div')
      bar.className = 'mv-list-toolbar'
      bar.style.display = 'none'

      const makeBtn = (action: ListAction, svg: string, label: string) => {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'mv-list-toolbar-btn'
        btn.setAttribute('aria-label', label)
        btn.innerHTML = svg
        // pointerdown + preventDefault keeps editor focus (and the keyboard) up
        btn.addEventListener('pointerdown', e => {
          e.preventDefault()
          e.stopPropagation()
          runList(view, action)
          reposition()
        })
        return btn
      }

      const outdentBtn = makeBtn('outdent', OUTDENT_SVG, 'Outdent list item')
      const indentBtn  = makeBtn('indent',  INDENT_SVG,  'Indent list item')
      bar.append(outdentBtn, indentBtn)
      document.body.appendChild(bar)

      let focused = false

      const keyboardOverlap = (): number => {
        const vv = window.visualViewport
        if (!vv) return 0
        return Math.max(window.innerHeight - vv.height - vv.offsetTop, 0)
      }

      function reposition() {
        const overlap = keyboardOverlap()
        // Show only while editing a focused editor with the keyboard open.
        if (!view.editable || !focused || overlap < 60) {
          bar.style.display = 'none'
          return
        }
        const canIndent  = canRun(view.state, 'indent')
        const canOutdent = canRun(view.state, 'outdent')
        // Nothing to do unless the caret sits inside a list.
        if (!canIndent && !canOutdent) {
          bar.style.display = 'none'
          return
        }
        bar.style.display = 'flex'
        bar.style.bottom = `${overlap}px`
        indentBtn.toggleAttribute('disabled', !canIndent)
        outdentBtn.toggleAttribute('disabled', !canOutdent)
      }

      const onFocus = () => { focused = true; reposition() }
      const onBlur  = () => { focused = false; bar.style.display = 'none' }
      view.dom.addEventListener('focus', onFocus)
      view.dom.addEventListener('blur', onBlur)
      window.visualViewport?.addEventListener('resize', reposition)
      window.visualViewport?.addEventListener('scroll', reposition)

      return {
        update() { if (focused) reposition() },
        destroy() {
          view.dom.removeEventListener('focus', onFocus)
          view.dom.removeEventListener('blur', onBlur)
          window.visualViewport?.removeEventListener('resize', reposition)
          window.visualViewport?.removeEventListener('scroll', reposition)
          bar.remove()
        },
      }
    },
  })
})
