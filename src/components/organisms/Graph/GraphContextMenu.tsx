import { useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUpRight, Link2, Search, X } from 'lucide-react'
import { useAppStore } from '../../../store/useAppStore'
import type { NodeType } from '../../../types/graph.types'

interface Props {
  x: number
  y: number
  nodeId: string
  nodeLabel: string
  nodeType: NodeType
  onClose: () => void
  onOpenNote: (noteId: string) => void
  onOpenTask: (nodeId: string) => void
  onLinkToNote: (sourceId: string, targetNoteId: string) => void
}

export function GraphContextMenu({
  x, y, nodeId, nodeLabel, nodeType,
  onClose, onOpenNote, onOpenTask, onLinkToNote,
}: Props) {
  const notes       = useAppStore(s => s.notes)
  const [showPicker, setShowPicker] = useState(false)
  const [search,     setSearch]     = useState('')

  const filteredNotes = notes.filter(n =>
    n.id !== nodeId &&
    (n.title || 'Untitled').toLowerCase().includes(search.toLowerCase()),
  )

  // Clamp to viewport
  const menuW = 240
  const left  = Math.min(x, window.innerWidth  - menuW - 8)
  const top   = Math.min(y, window.innerHeight - (showPicker ? 320 : 120) - 8)

  return createPortal(
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[9998]" onClick={onClose} />

      <div
        className="fixed z-[9999] min-w-[240px] rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] shadow-2xl"
        style={{ left, top }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[rgb(var(--border))] px-3 py-2">
          <span className="max-w-[170px] truncate text-xs font-semibold text-[rgb(var(--text))]">
            {nodeLabel}
          </span>
          <button onClick={onClose} className="text-[rgb(var(--text-3))] hover:text-[rgb(var(--text))]">
            <X size={13} />
          </button>
        </div>

        {!showPicker ? (
          <div className="py-1">
            {nodeType === 'note' && (
              <button
                onClick={() => { onOpenNote(nodeId); onClose() }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-[rgb(var(--text))] hover:bg-[rgb(var(--surface-2))]"
              >
                <ArrowUpRight size={14} className="shrink-0 text-[rgb(var(--text-3))]" />
                Open note
              </button>
            )}
            {nodeType === 'task' && (
              <button
                onClick={() => { onOpenTask(nodeId); onClose() }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-[rgb(var(--text))] hover:bg-[rgb(var(--surface-2))]"
              >
                <ArrowUpRight size={14} className="shrink-0 text-[rgb(var(--text-3))]" />
                Open task
              </button>
            )}
            <button
              onClick={() => setShowPicker(true)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-[rgb(var(--text))] hover:bg-[rgb(var(--surface-2))]"
            >
              <Link2 size={14} className="shrink-0 text-[rgb(var(--text-3))]" />
              {nodeType === 'note' ? 'Connect to note…' : 'Link to note…'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="relative border-b border-[rgb(var(--border))] px-3 py-2">
              <Search size={12} className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[rgb(var(--text-3))]" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search notes…"
                className="w-full rounded-md bg-[rgb(var(--surface-2))] py-1.5 pl-7 pr-3 text-xs text-[rgb(var(--text))] outline-none placeholder:text-[rgb(var(--text-3))]"
              />
            </div>
            <ul className="max-h-52 overflow-y-auto py-1">
              {filteredNotes.length === 0 ? (
                <li className="px-3 py-2 text-xs text-[rgb(var(--text-3))]">No notes found</li>
              ) : (
                filteredNotes.map(note => (
                  <li key={note.id}>
                    <button
                      onClick={() => { onLinkToNote(nodeId, note.id); onClose() }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[rgb(var(--text))] hover:bg-[rgb(var(--surface-2))]"
                    >
                      <Link2 size={11} className="shrink-0 text-[rgb(var(--accent))]" />
                      <span className="truncate">{note.title || 'Untitled note'}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
    </>,
    document.body,
  )
}
