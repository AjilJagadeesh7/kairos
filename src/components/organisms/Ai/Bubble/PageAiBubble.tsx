import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAiStore } from '../../../../store/useAiStore'
import { useAppStore } from '../../../../store/useAppStore'
import { usePaneStore } from '../../../../store/usePaneStore'
import { eventMatchesAction } from '../../../../hooks/useShortcutKey'
import { useFabSuppressed } from '../../../../hooks/useFabSuppressed'
import { Icon } from '../../../../icons/Icon'
import { AI_BUBBLE_EVENT, bubblePagePath } from './bubbleEvent'

interface PageAiBubbleProps {
  /** This page's route, e.g. `/notes/<id>` — matched against the focused pane. */
  pagePath: string
  /** Button label, e.g. "Ask AI about this note". */
  label: string
  /** The panel (lazy-loaded by the caller), rendered while open. */
  renderPanel: (close: () => void) => ReactNode
}

/** Floating "Ask AI" button on a page, shown only while the AI toggle is on. */
export function PageAiBubble({ pagePath, label, renderPanel }: PageAiBubbleProps) {
  const enabled = useAiStore((s) => s.enabled)
  const keyBindings = useAppStore((s) => s.keyBindings)
  const [open, setOpen] = useState(false)
  const fabSuppressed = useFabSuppressed()
  const pathRef = useRef(pagePath)
  useEffect(() => { pathRef.current = pagePath }, [pagePath])

  useEffect(() => {
    if (!enabled) return
    const onEvent = (e: Event) => {
      if ((e as CustomEvent<{ pagePath: string }>).detail?.pagePath === pathRef.current) setOpen(true)
    }
    const onKey = (e: KeyboardEvent) => {
      if (!eventMatchesAction(e, 'toggle-ai-bubble', keyBindings)) return
      // With split panes, only the focused pane's page reacts.
      const { panes, focusedPaneId } = usePaneStore.getState()
      const pane = panes.find((p) => p.id === focusedPaneId)
      const tabPath = pane?.tabs.find((t) => t.id === pane.activeTabId)?.path ?? ''
      if (bubblePagePath(tabPath) !== pathRef.current) return
      e.preventDefault()
      setOpen((o) => !o)
    }
    window.addEventListener(AI_BUBBLE_EVENT, onEvent)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener(AI_BUBBLE_EVENT, onEvent)
      window.removeEventListener('keydown', onKey)
    }
  }, [enabled, keyBindings])

  if (!enabled) return null

  return open ? (
    <Suspense fallback={null}>{renderPanel(() => setOpen(false))}</Suspense>
  ) : (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => setOpen(true)}
      // Phones: fixed, stacked above the mobile nav button (h-14 at bottom 1rem)
      // and hidden with it while the keyboard is up. Desktop: corner of the page.
      // Text-on-surface colours: every theme (plugin themes too) keeps that pair
      // readable, unlike accent/accent-fg which a theme may only half define.
      className={`fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-[22px] z-20 flex h-11 w-11 items-center justify-center rounded-full border border-text/25 bg-surface text-text shadow-lg shadow-black/20 transition hover:scale-105 hover:border-accent hover:text-accent hover:shadow-xl
        md:absolute md:bottom-4 md:right-4 md:z-30 ${fabSuppressed ? 'pointer-events-none opacity-0 md:pointer-events-auto md:opacity-100' : ''}`}
    >
      <Icon name="sparkles" size={20} />
    </button>
  )
}
