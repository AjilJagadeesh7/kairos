import { type RefObject, useCallback, useEffect, useState } from 'react'
import { editorViewCtx } from '@milkdown/core'
import type { Crepe } from '@milkdown/crepe'

export interface SlashState {
  visible: boolean
  query: string
  x: number
  y: number
}

const HIDDEN: SlashState = { visible: false, query: '', x: 0, y: 0 }

// "/" at the very start of an otherwise-empty paragraph, optionally followed by a
// word query — the standard slash-command trigger (won't fire mid-sentence).
const SLASH_RE = /^\/([\w-]*)$/

// Keys the SlashMenu itself handles — don't refresh on their keyup.
const PASSTHROUGH = new Set(['Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Tab'])

/**
 * Detects the "/" slash command in the editor and exposes the query + caret
 * position for a custom <SlashMenu>. Mirrors useWikilinkAutocomplete.
 */
export function useSlashMenu(crepeRef: RefObject<Crepe>, rootRef: RefObject<HTMLElement>) {
  const [slash, setSlash] = useState<SlashState>(HIDDEN)

  const dismiss = useCallback(() => setSlash(HIDDEN), [])

  const refresh = useCallback(() => {
    const crepe = crepeRef.current
    if (!crepe) return
    let next: SlashState | null = null
    crepe.editor.action(ctx => {
      try {
        const view = ctx.get(editorViewCtx)
        const { $from } = view.state.selection
        if (!$from.parent.isTextblock || $from.parent.type.name !== 'paragraph') return
        const before = $from.parent.textContent.slice(0, $from.parentOffset)
        const m = SLASH_RE.exec(before)
        if (!m) return
        const coords = view.coordsAtPos($from.pos)
        next = { visible: true, query: m[1], x: coords.left, y: coords.bottom + 4 }
      } catch { /* editor not ready */ }
    })
    setSlash(next ?? HIDDEN)
  }, [crepeRef])

  // Delete the "/query" trigger text, then run the chosen editor command on the
  // now-clean paragraph.
  const runCommand = useCallback((fn: () => void) => {
    const crepe = crepeRef.current
    if (crepe) {
      crepe.editor.action(ctx => {
        try {
          const view = ctx.get(editorViewCtx)
          const { $from, from } = view.state.selection
          const before = $from.parent.textContent.slice(0, $from.parentOffset)
          const m = SLASH_RE.exec(before)
          if (m) view.dispatch(view.state.tr.delete(from - m[0].length, from))
        } catch { /* ignore */ }
      })
    }
    setSlash(HIDDEN)
    fn()
  }, [crepeRef])

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const onKeyUp = (e: KeyboardEvent) => {
      if (PASSTHROUGH.has(e.key)) return
      refresh()
    }
    el.addEventListener('keyup', onKeyUp)
    // The "+" block handle inserts "/" programmatically (no keystroke), so it
    // asks us to re-detect via this event.
    const onOpen = () => refresh()
    window.addEventListener('mv:open-slash', onOpen)
    return () => {
      el.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mv:open-slash', onOpen)
    }
  }, [rootRef, refresh])

  return { slash, dismiss, runCommand }
}
