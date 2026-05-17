import { RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { editorViewCtx } from '@milkdown/core'
import type { Crepe } from '@milkdown/crepe'
import type { Note } from '../types'

export interface AutocompleteState {
  visible: boolean
  query: string
  x: number
  y: number
}

const HIDDEN: AutocompleteState = { visible: false, query: '', x: 0, y: 0 }

const PASSTHROUGH_KEYS = new Set(['Escape', 'ArrowUp', 'ArrowDown', 'Enter', 'Tab'])

export function useWikilinkAutocomplete(
  crepeRef: RefObject<Crepe | null>,
  rootRef: RefObject<HTMLElement | null>,
  notes: Note[],
) {
  const [ac, setAc] = useState<AutocompleteState>(HIDDEN)
  const notesRef = useRef(notes)
  useEffect(() => { notesRef.current = notes }, [notes])

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
        const m = /\[\[([^\]\n]*)$/.exec(textBefore)
        if (!m) return
        const coords = view.coordsAtPos($from.pos)
        next = { visible: true, query: m[1], x: coords.left, y: coords.bottom + 4 }
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
        const m = /\[\[([^\]\n]*)$/.exec(textBefore)
        if (!m) return
        const textNode = view.state.schema.text(`[[${title}]]`)
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

  const suggestions = ac.visible
    ? notesRef.current
        .filter(n => n.title.toLowerCase().includes(ac.query.toLowerCase()))
        .slice(0, 8)
    : []

  return { ac, suggestions, complete, dismiss }
}
