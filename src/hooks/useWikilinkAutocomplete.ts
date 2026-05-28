import { RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { editorViewCtx } from '@milkdown/core'
import type { Crepe } from '@milkdown/crepe'
import { useAppStore } from '../store/useAppStore'

export interface AutocompleteState {
  visible: boolean
  query: string
  x: number
  y: number
  isTransclusion: boolean
}

const HIDDEN: AutocompleteState = { visible: false, query: '', x: 0, y: 0, isTransclusion: false }

// Matches both [[query and ![[query at the end of the text-before-cursor
const AC_RE = /(!?\[\[)([^\]\n]*)$/

const PASSTHROUGH_KEYS = new Set(['Escape', 'ArrowUp', 'ArrowDown', 'Enter', 'Tab'])

export function useWikilinkAutocomplete(
  crepeRef: RefObject<Crepe>,
  rootRef: RefObject<HTMLElement>,
) {
  const [ac, setAc] = useState<AutocompleteState>(HIDDEN)

  // Subscribe only to note titles — this selector never re-fires on content/updatedAt changes,
  // so MarkdownEditor is completely decoupled from save-triggered store updates.
  const noteTitles = useAppStore(s => s.notes.map(n => n.title).join('\0'))
  const lowerIndex = useRef<Array<{ title: string; lower: string }>>([])
  useEffect(() => {
    const titles = useAppStore.getState().notes.map(n => n.title)
    lowerIndex.current = titles.map(t => ({ title: t, lower: t.toLowerCase() }))
  }, [noteTitles])

  const dismiss = useCallback(() => setAc(HIDDEN), [])

  const refresh = useCallback(() => {
    const crepe = crepeRef.current
    if (!crepe) return
    let next: AutocompleteState | null = null
    crepe.editor.action((ctx) => {
      try {
        const view = ctx.get(editorViewCtx)
        const { $from } = view.state.selection
        if (!$from.parent.isTextblock) return
        const textBefore = $from.parent.textContent.slice(0, $from.parentOffset)
        const m = AC_RE.exec(textBefore)
        if (!m) return
        const coords = view.coordsAtPos($from.pos)
        next = { visible: true, query: m[2], x: coords.left, y: coords.bottom + 4, isTransclusion: m[1].startsWith('!') }
      } catch { /* editor not ready */ }
    })
    setAc(next ?? HIDDEN)
  }, [crepeRef])

  const complete = useCallback((title: string) => {
    const crepe = crepeRef.current
    if (!crepe) return
    crepe.editor.action((ctx) => {
      try {
        const view = ctx.get(editorViewCtx)
        const { $from, from } = view.state.selection
        const textBefore = $from.parent.textContent.slice(0, $from.parentOffset)
        const m = AC_RE.exec(textBefore)
        if (!m) return
        const prefix = m[1].startsWith('!') ? '!' : ''
        const textNode = view.state.schema.text(`${prefix}[[${title}]]`)
        view.dispatch(view.state.tr.replaceWith(from - m[0].length, from, textNode))
        view.focus()
      } catch { /* ignore */ }
    })
    dismiss()
  }, [crepeRef, dismiss])

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const onKeyUp = (e: KeyboardEvent) => {
      if (PASSTHROUGH_KEYS.has(e.key)) return
      refresh()
    }
    el.addEventListener('keyup', onKeyUp)
    return () => el.removeEventListener('keyup', onKeyUp)
  }, [rootRef, refresh])

  const suggestions = useMemo(() => {
    if (!ac.visible) return []
    const q = ac.query.toLowerCase()
    const results: string[] = []
    for (const entry of lowerIndex.current) {
      if (entry.lower.includes(q)) {
        results.push(entry.title)
        if (results.length === 8) break   // early exit — no need to scan further
      }
    }
    return results
  }, [ac.visible, ac.query])

  return { ac, suggestions, complete, dismiss }
}
