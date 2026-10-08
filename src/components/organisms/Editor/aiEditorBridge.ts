import { editorViewCtx, parserCtx } from '@milkdown/core'
import { getMarkdown, markdownToSlice } from '@milkdown/utils'
import type { Crepe } from '@milkdown/crepe'
import type { Ctx } from '@milkdown/ctx'
import type { EditorView } from '@milkdown/prose/view'
import { aiSuggestionKey, type SuggestionMeta } from './aiSuggestionPlugin'
import { isTouch } from '../../../utils/platform'
import type { NoteEditorBridge } from '../../../types'

const LEAF = '￼'

function textOf(view: EditorView, from: number, to: number): string {
  return view.state.doc.textBetween(from, to, '\n\n', LEAF)
}

/**
 * The selection range. ProseMirror syncs a fresh DOM selection (triple-click,
 * native handles on Android) asynchronously, so when its state is still empty
 * the live DOM selection inside the editor is used instead.
 */
function selectedRange(view: EditorView): { from: number; to: number } | null {
  const { from, to, empty } = view.state.selection
  if (!empty) return { from, to }
  const dom = view.dom.ownerDocument.getSelection()
  if (!dom || dom.isCollapsed || !dom.anchorNode || !dom.focusNode) return null
  if (!view.dom.contains(dom.anchorNode) || !view.dom.contains(dom.focusNode)) return null
  try {
    const a = view.posAtDOM(dom.anchorNode, dom.anchorOffset)
    const b = view.posAtDOM(dom.focusNode, dom.focusOffset)
    return a === b ? null : { from: Math.min(a, b), to: Math.max(a, b) }
  } catch {
    return null
  }
}

function revealPreview(view: EditorView) {
  requestAnimationFrame(() => {
    view.dom.querySelector('.ai-suggest-ins')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  })
}

/**
 * The note bubble's view of the editor: read the selection, preview a
 * suggestion, and apply it on Accept (one undoable transaction — Ctrl+Z
 * reverts it like any edit).
 */
export function createNoteEditorBridge(crepeRef: { readonly current: Crepe | null }): NoteEditorBridge {
  function withView<T>(fallback: T, run: (view: EditorView, ctx: Ctx) => T): T {
    const crepe = crepeRef.current
    if (!crepe) return fallback
    let out = fallback
    try {
      crepe.editor.action((ctx) => { out = run(ctx.get(editorViewCtx), ctx) })
    } catch (err) {
      console.warn('[ai] editor not ready:', err)
      return fallback
    }
    return out
  }

  const dispatchMeta = (view: EditorView, meta: SuggestionMeta) =>
    view.dispatch(view.state.tr.setMeta(aiSuggestionKey, meta))

  return {
    markdown: () => withView(null, (_view, ctx) => getMarkdown()(ctx)),

    selection: () => withView(null, (view, ctx) => {
      const range = selectedRange(view)
      if (!range) return null
      const { from, to } = range
      const text = textOf(view, from, to)
      if (!text.trim()) return null
      return { from, to, text, markdown: getMarkdown({ from, to })(ctx).trim() }
    }),

    continuePoint: (pos) => withView(null, (view, ctx) => {
      const { doc, selection } = view.state
      const end = doc.content.size
      let at = end
      if (pos !== undefined) at = Math.min(pos, end)
      // A caret parked at the very start means the editor was never used: append.
      else if (selection.head > 1 && selection.$head.depth >= 1) at = selection.$head.after(1)
      return { pos: at, before: at > 0 ? getMarkdown({ from: 0, to: at })(ctx).trim() : '' }
    }),

    showPreview: (range, originalText, proposed) => withView(undefined, (view) => {
      dispatchMeta(view, { type: 'show', preview: { id: Date.now(), ...range, originalText, proposed } })
      revealPreview(view)
    }),

    clearPreview: () => withView(undefined, (view) => {
      if (aiSuggestionKey.getState(view.state)) dispatchMeta(view, { type: 'clear' })
    }),

    previewRange: () => withView(null, (view) => {
      const p = aiSuggestionKey.getState(view.state)
      return p ? { from: p.from, to: p.to } : null
    }),

    applyPreview: (markdown) => withView<'ok' | 'changed' | 'missing'>('missing', (view, ctx) => {
      const p = aiSuggestionKey.getState(view.state)
      if (!p) return 'missing'
      if (textOf(view, p.from, p.to) !== p.originalText) return 'changed'
      const tr = p.from === p.to
        ? view.state.tr.insert(p.from, ctx.get(parserCtx)(markdown).content)
        : view.state.tr.replace(p.from, p.to, markdownToSlice(markdown)(ctx))
      view.dispatch(tr.setMeta(aiSuggestionKey, { type: 'clear' } satisfies SuggestionMeta).scrollIntoView())
      // Back to the editor so Ctrl+Z undoes the change right away (not on touch,
      // where focusing would pop up the keyboard).
      if (!isTouch()) view.focus()
      return 'ok'
    }),

    insertAtTop: (markdown) => withView(false, (view, ctx) => {
      const doc = ctx.get(parserCtx)(markdown)
      if (!doc) return false
      view.dispatch(view.state.tr.insert(0, doc.content))
      view.dom.scrollTop = 0
      return true
    }),
  }
}
