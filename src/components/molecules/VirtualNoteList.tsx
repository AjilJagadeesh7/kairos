import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { NoteListItem } from './NoteListItem'
import type { Note, TagRecord } from '../../types'

interface VirtualNoteListProps {
  notes: Note[]
  activeNoteId: string | null | undefined
  copiedId: string | null
  tagMap: Map<string, TagRecord>
  query: string
  onOpen: (id: string) => void
  onDelete: (e: React.MouseEvent, note: Note) => void
  onCopyLink: (e: React.MouseEvent, note: Note) => void
}

export function VirtualNoteList({
  notes, activeNoteId, copiedId, tagMap, query, onOpen, onDelete, onCopyLink,
}: VirtualNoteListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: notes.length,
    getScrollElement: () => scrollRef.current,
    // Notes without tags ~32px, with tags ~52px. Use 52 as safe estimate;
    // measureElement provides accurate heights for items already rendered.
    estimateSize: () => 52,
    overscan: 6,
  })

  if (notes.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-text3">
        No notes match &ldquo;{query}&rdquo;
      </div>
    )
  }

  const items = virtualizer.getVirtualItems()

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-y-auto px-1"
      role="listbox"
      aria-label="Search results"
    >
      <div
        style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${items[0]?.start ?? 0}px)`,
          }}
        >
          {items.map(virtualRow => {
            const note = notes[virtualRow.index]
            return (
              <div
                key={note.id}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                role="option"
                aria-selected={activeNoteId === note.id}
                className="relative"
              >
                <NoteListItem
                  note={note}
                  isActive={activeNoteId === note.id}
                  isCopied={copiedId === note.id}
                  tagMap={tagMap}
                  onOpen={() => onOpen(note.id)}
                  onDelete={e => onDelete(e, note)}
                  onCopyLink={e => onCopyLink(e, note)}
                />
                {note.folder && (
                  <span className="pointer-events-none absolute bottom-[5px] right-24 text-[10px] text-text3/50">
                    {note.folder}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
