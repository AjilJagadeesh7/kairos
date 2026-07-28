import { Plugin, PluginKey, TextSelection } from '@milkdown/prose/state'
import { type EditorView } from '@milkdown/prose/view'
import { $prose } from '@milkdown/utils'

// Since Crepe's BlockEdit (which owned the "+" handle) is disabled in favour of
// the custom <SlashMenu>, this plugin provides the "+" affordance for every
// platform. It shows a "+" in the left gutter aligned to the caret line; clicking
// it inserts a fresh paragraph after the active block, drops a "/" in it, and
// asks the SlashMenu to open — the same menu you get by typing "/".
//
// IMPORTANT: the button lives OUTSIDE the contenteditable (appended to the
// `.milkdown` wrapper) and is positioned via coordsAtPos, so it never interferes
// with native click-to-place-caret. Shown only while editable.

const mobileAddBlockKey = new PluginKey('mvAddBlock')

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
  // The "/" was inserted programmatically (no keyup), so nudge the SlashMenu to detect it.
  window.dispatchEvent(new Event('mv:open-slash'))
}

export const addBlockPlugin = $prose(() => {
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
        if (!view.editable || !selection.empty || selection.$from.depth === 0) {
          btn.style.display = 'none'
          return
        }
        try {
          // Anchor to the current block's DOM element. coordsAtPos is unreliable
          // for empty paragraphs (it can report the document end), so use the rect.
          const domPos = view.domAtPos(selection.from)
          const raw = domPos.node.nodeType === Node.TEXT_NODE
            ? domPos.node.parentElement
            : (domPos.node as HTMLElement)
          const blockEl = raw?.closest('p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,td,th') ?? raw
          const rect = blockEl?.getBoundingClientRect()
          if (!rect) { btn.style.display = 'none'; return }
          const hostRect = host.getBoundingClientRect()
          const proseRect = view.dom.getBoundingClientRect()
          // Hide when the block is scrolled out of the editor viewport.
          if (rect.top < proseRect.top - 4 || rect.top > proseRect.bottom - 4) {
            btn.style.display = 'none'
            return
          }
          // Viewport coordinates (position: fixed) — left gutter of the editor.
          btn.style.display = 'flex'
          btn.style.top = `${rect.top}px`
          btn.style.left = `${hostRect.left + 6}px`
          btn.style.height = `${Math.min(Math.max(rect.height, 20), 30)}px`
        } catch {
          btn.style.display = 'none'
        }
      }

      // Reposition on internal editor scroll (caret line moves visually).
      const onScroll = () => reposition()
      view.dom.addEventListener('scroll', onScroll, { passive: true })
      // Clicking into an already-empty paragraph doesn't fire update(); recompute
      // on focus so a brand-new note anchors the handle correctly.
      const onFocus = () => reposition()
      view.dom.addEventListener('focusin', onFocus)

      reposition()
      // First layout pass can be unsettled — recompute next frame.
      const raf = requestAnimationFrame(reposition)

      return {
        update() { reposition() },
        destroy() {
          cancelAnimationFrame(raf)
          view.dom.removeEventListener('scroll', onScroll)
          view.dom.removeEventListener('focusin', onFocus)
          btn.remove()
        },
      }
    },
  })
})
