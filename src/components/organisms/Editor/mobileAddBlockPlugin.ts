import { Plugin, PluginKey, TextSelection } from '@milkdown/prose/state'
import { type EditorView } from '@milkdown/prose/view'
import { $prose } from '@milkdown/utils'

// On touch devices there is no hover, so Crepe's block-edit "+" handle (driven
// by pointermove and hidden on every keydown) never reliably appears. This
// plugin shows a persistent "+" in the left gutter, aligned to the line that
// currently holds the caret. Tapping it inserts a fresh paragraph after the
// active top-level block and opens the slash menu — same outcome as the desktop
// handle's add action, but anchored to focus instead of hover.
//
// IMPORTANT: the button lives OUTSIDE the contenteditable (appended to the
// `.milkdown` wrapper) and is positioned via coordsAtPos. Keeping it out of the
// ProseMirror DOM means it never interferes with native tap-to-place-caret.
//
// Renders only on coarse-pointer (touch) devices, only while editable.

const mobileAddBlockKey = new PluginKey('mvMobileAddBlock')

function isTouch(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches
}

const PLUS_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" width="18" height="18">' +
  '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'

// Insert an empty paragraph after the active top-level block, drop a "/" into it
// and place the caret at the end — Crepe's slash menu shows itself when the
// current paragraph text starts with "/" and the caret sits at its end.
function openBlockMenu(view: EditorView) {
  const { state } = view
  const { $from } = state.selection
  if ($from.depth === 0) return

  const paragraph = state.schema.nodes.paragraph
  if (!paragraph) return

  const after = $from.before(1) + $from.node(1).nodeSize
  const node = paragraph.create(null, state.schema.text('/'))

  let tr = state.tr.insert(after, node)
  // after = paragraph open; +2 lands just past the inserted "/" (end of block)
  tr = tr.setSelection(TextSelection.near(tr.doc.resolve(after + 2))).scrollIntoView()
  view.dispatch(tr)
  view.focus()
}

export const mobileAddBlockPlugin = $prose(() => {
  return new Plugin({
    key: mobileAddBlockKey,
    view(view) {
      const host = view.dom.closest('.milkdown') as HTMLElement | null
      if (!host) return {}

      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'mv-add-block'
      btn.setAttribute('aria-label', 'Insert block')
      btn.innerHTML = PLUS_SVG
      btn.style.display = 'none'
      // pointerdown + preventDefault keeps the editor selection intact (no blur)
      btn.addEventListener('pointerdown', e => {
        e.preventDefault()
        e.stopPropagation()
        openBlockMenu(view)
      })
      host.appendChild(btn)

      const reposition = () => {
        const { selection } = view.state
        if (!view.editable || !isTouch() || !selection.empty || selection.$from.depth === 0) {
          btn.style.display = 'none'
          return
        }
        try {
          const coords = view.coordsAtPos(selection.from)
          const hostRect = host.getBoundingClientRect()
          const proseRect = view.dom.getBoundingClientRect()
          // Hide when the caret line is scrolled out of the editor viewport.
          if (coords.top < proseRect.top - 4 || coords.bottom > proseRect.bottom + 4) {
            btn.style.display = 'none'
            return
          }
          btn.style.display = 'flex'
          btn.style.top = `${coords.top - hostRect.top}px`
          btn.style.height = `${Math.max(coords.bottom - coords.top, 20)}px`
        } catch {
          btn.style.display = 'none'
        }
      }

      // Reposition on internal editor scroll (caret line moves visually).
      const onScroll = () => reposition()
      view.dom.addEventListener('scroll', onScroll, { passive: true })

      reposition()

      return {
        update() { reposition() },
        destroy() {
          view.dom.removeEventListener('scroll', onScroll)
          btn.remove()
        },
      }
    },
  })
})
