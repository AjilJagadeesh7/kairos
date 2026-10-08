import { Suspense, lazy, useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import type { Crepe } from '@milkdown/crepe'
import { useAiStore } from '../../../../store/useAiStore'
import { useAppStore } from '../../../../store/useAppStore'
import { usePaneStore } from '../../../../store/usePaneStore'
import { eventMatchesAction } from '../../../../hooks/useShortcutKey'
import { useFabSuppressed } from '../../../../hooks/useFabSuppressed'
import { Icon } from '../../../../icons/Icon'
import { AI_BUBBLE_EVENT } from './bubbleEvent'
import type { NoteSnapshot } from '../../../../types'

// The panel (and with it every AI module) loads only when the bubble opens.
const NoteBubblePanel = lazy(() => import('./NoteBubblePanel'))

interface NoteAiBubbleProps {
  note: NoteSnapshot
  vocabulary: string[]
  editorRef: MutableRefObject<Crepe | null>
  onApplyTitle: (title: string) => void
  onApplyTags: (tags: string[]) => void
}

/** Floating "Ask AI" button on a note, shown only while the AI toggle is on. */
export function NoteAiBubble({ note, vocabulary, editorRef, onApplyTitle, onApplyTags }: NoteAiBubbleProps) {
  const enabled = useAiStore((s) => s.enabled)
  const keyBindings = useAppStore((s) => s.keyBindings)
  const [open, setOpen] = useState(false)
  const fabSuppressed = useFabSuppressed()

  // The panel reads the live draft through stable getters.
  const latest = useRef({ note, vocabulary, onApplyTitle, onApplyTags })
  useEffect(() => { latest.current = { note, vocabulary, onApplyTitle, onApplyTags } })
  const getNote = useCallback(() => latest.current.note, [])
  const getVocabulary = useCallback(() => latest.current.vocabulary, [])
  const applyTitle = useCallback((t: string) => latest.current.onApplyTitle(t), [])
  const applyTags = useCallback((t: string[]) => latest.current.onApplyTags(t), [])

  useEffect(() => {
    if (!enabled) return
    const onEvent = (e: Event) => {
      if ((e as CustomEvent<{ noteId: string }>).detail?.noteId === latest.current.note.id) setOpen(true)
    }
    const onKey = (e: KeyboardEvent) => {
      if (!eventMatchesAction(e, 'toggle-ai-bubble', keyBindings)) return
      // With split panes, only the focused pane's note reacts.
      const { panes, focusedPaneId } = usePaneStore.getState()
      const pane = panes.find((p) => p.id === focusedPaneId)
      if (pane?.tabs.find((t) => t.id === pane.activeTabId)?.path !== `/notes/${latest.current.note.id}`) return
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
    <Suspense fallback={null}>
      <NoteBubblePanel
        getNote={getNote}
        editorRef={editorRef}
        vocabulary={getVocabulary}
        onApplyTitle={applyTitle}
        onApplyTags={applyTags}
        onClose={() => setOpen(false)}
      />
    </Suspense>
  ) : (
    <button
      type="button"
      aria-label="Ask AI about this note"
      title="Ask AI about this note"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => setOpen(true)}
      // Phones: fixed, stacked above the mobile nav button (h-14 at bottom 1rem)
      // and hidden with it while the keyboard is up. Desktop: corner of the editor.
      // Text-on-surface colours: every theme (plugin themes too) keeps that pair
      // readable, unlike accent/accent-fg which a theme may only half define.
      className={`fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-[22px] z-20 flex h-11 w-11 items-center justify-center rounded-full border border-text/25 bg-surface text-text shadow-lg shadow-black/20 transition hover:scale-105 hover:border-accent hover:text-accent hover:shadow-xl
        md:absolute md:bottom-4 md:right-4 md:z-30 ${fabSuppressed ? 'pointer-events-none opacity-0 md:pointer-events-auto md:opacity-100' : ''}`}
    >
      <Icon name="sparkles" size={20} />
    </button>
  )
}
