import { RefObject, useState } from 'react'

interface TooltipState {
  visible: boolean
  title: string
  x: number
  y: number
}

const INITIAL: TooltipState = { visible: false, title: '', x: 0, y: 0 }

export function useWikilinkTooltip(rootRef: RefObject<HTMLElement>) {
  const [tooltip, setTooltip] = useState<TooltipState>(INITIAL)

  function attach() {
    const el = rootRef.current
    if (!el) return () => {}

    const handler = (e: MouseEvent) => {
      const token = (e.target as HTMLElement).closest('.wikilink-token') as HTMLElement | null
      if (!token) return
      const raw   = token.textContent ?? ''
      const title = raw.replace(/^\[\[|\]\]$/g, '').trim()
      if (!title) return
      e.preventDefault()
      e.stopPropagation()
      const rect = token.getBoundingClientRect()
      setTooltip({ visible: true, title, x: rect.left + rect.width / 2, y: rect.bottom })
    }

    el.addEventListener('click', handler)
    return () => el.removeEventListener('click', handler)
  }

  function dismiss() {
    setTooltip(s => ({ ...s, visible: false }))
  }

  return { tooltip, attach, dismiss }
}
