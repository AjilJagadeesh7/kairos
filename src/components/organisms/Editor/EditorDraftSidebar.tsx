import { useState } from 'react'
import { NoteRightSidebar } from './NoteRightSidebar'
import { useIsMobile } from '../../../hooks/useIsMobile'
import type { Note, TagRecord } from '../../../types'

interface EditorDraftSidebarProps {
  note: Note
  title: string
  content: string
  tags: string[]
  tagMap: Map<string, TagRecord>
  allTags: TagRecord[]
  onTagsChange: (tags: string[]) => Promise<void>
  onTagCreate: (name: string, color: string) => void
  onClose: () => void
}

/**
 * The note editor's right sidebar. On desktop it is a resizable column; on
 * mobile it becomes an overlay drawer so it never eats into reading width.
 */
export function EditorDraftSidebar(props: EditorDraftSidebarProps): JSX.Element {
  const { onClose, ...panelProps } = props
  const isMobile = useIsMobile()
  const [width, setWidth] = useState(268)

  // Pointer events (not mouse events) so touch/pen can resize on tablets.
  function startResize(e: React.PointerEvent) {
    e.preventDefault()
    const startX = e.clientX
    const startW = width

    const onMove = (ev: PointerEvent) => {
      const delta = startX - ev.clientX   // drag left → wider
      setWidth(Math.max(200, Math.min(520, startW + delta)))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  if (isMobile) {
    return (
      <>
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[1px]"
          onClick={onClose}
          aria-hidden
        />
        <div
          className="fixed inset-y-0 right-0 z-40 overflow-hidden border-l border-border bg-surface2"
          style={{ width: Math.min(320, window.innerWidth * 0.85), paddingTop: 'env(safe-area-inset-top)' }}
        >
          <NoteRightSidebar {...panelProps} />
        </div>
      </>
    )
  }

  return (
    <>
      {/* Drag handle — sits on the border, widens hit area with padding */}
      <div
        className="group relative z-10 w-1 shrink-0 cursor-col-resize touch-none bg-border transition-colors hover:bg-accent/50 active:bg-accent"
        onPointerDown={startResize}
      >
        {/* Wider invisible hit area */}
        <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
      </div>

      <div style={{ width }} className="shrink-0 overflow-hidden">
        <NoteRightSidebar {...panelProps} />
      </div>
    </>
  )
}
