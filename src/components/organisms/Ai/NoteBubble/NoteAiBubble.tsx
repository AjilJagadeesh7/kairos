import { lazy, useCallback, useEffect, useRef, type MutableRefObject } from 'react'
import type { Crepe } from '@milkdown/crepe'
import { PageAiBubble } from '../Bubble/PageAiBubble'
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

/** The page bubble on a note. */
export function NoteAiBubble({ note, vocabulary, editorRef, onApplyTitle, onApplyTags }: NoteAiBubbleProps) {
  // The panel reads the live draft through stable getters.
  const latest = useRef({ note, vocabulary, onApplyTitle, onApplyTags })
  useEffect(() => { latest.current = { note, vocabulary, onApplyTitle, onApplyTags } })
  const getNote = useCallback(() => latest.current.note, [])
  const getVocabulary = useCallback(() => latest.current.vocabulary, [])
  const applyTitle = useCallback((t: string) => latest.current.onApplyTitle(t), [])
  const applyTags = useCallback((t: string[]) => latest.current.onApplyTags(t), [])

  return (
    <PageAiBubble
      pagePath={`/notes/${note.id}`}
      label="Ask AI about this note"
      renderPanel={(close) => (
        <NoteBubblePanel
          getNote={getNote}
          editorRef={editorRef}
          vocabulary={getVocabulary}
          onApplyTitle={applyTitle}
          onApplyTags={applyTags}
          onClose={close}
        />
      )}
    />
  )
}
