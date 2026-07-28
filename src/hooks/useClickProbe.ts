import { useEffect } from 'react'
import { logger } from '../logger/logger'

/**
 * Dev-only diagnostic: logs the full stack of elements under every pointerdown.
 *
 * When a button "isn't clickable" the cause is almost always another element
 * sitting on top of it, and the only reliable way to identify that element is to
 * ask the browser what is actually at those coordinates. Reading the log beats
 * guessing at CSS.
 *
 * Read the output in Settings → Logs, context `click-probe`. The FIRST entry in
 * the arrow chain is what receives the click; if that isn't the control you
 * pressed, it's the blocker.
 */

function describe(el: Element): string {
  const tag = el.tagName.toLowerCase()
  const id = el.id ? `#${el.id}` : ''
  const cls = typeof el.className === 'string' && el.className.trim()
    ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.')
    : ''
  const label = el.getAttribute('aria-label') ?? el.getAttribute('title') ?? ''
  const style = window.getComputedStyle(el)
  const z = style.zIndex !== 'auto' ? ` z=${style.zIndex}` : ''
  const pe = style.pointerEvents === 'none' ? ' pe=none' : ''
  return `${tag}${id}${cls}${label ? `["${label}"]` : ''}${z}${pe}`
}

export function useClickProbe(): void {
  useEffect(() => {
    if (!import.meta.env.DEV) return

    function onDown(e: PointerEvent) {
      const stack = document.elementsFromPoint(e.clientX, e.clientY).slice(0, 5)
      logger.info(
        `click @${Math.round(e.clientX)},${Math.round(e.clientY)} `
        + `(vw=${window.innerWidth}) → ${stack.map(describe).join('  →  ')}`,
        'click-probe',
      )
    }

    window.addEventListener('pointerdown', onDown, true)
    return () => window.removeEventListener('pointerdown', onDown, true)
  }, [])
}
