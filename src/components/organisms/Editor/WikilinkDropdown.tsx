import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FileText, Link2 } from 'lucide-react'
import type { Note } from '../../../types'

interface WikilinkDropdownProps {
  x: number
  y: number
  query: string
  suggestions: Note[]
  onSelect: (title: string) => void
  onDismiss: () => void
}

export function WikilinkDropdown({ x, y, query, suggestions, onSelect, onDismiss }: WikilinkDropdownProps) {
  const [activeIdx, setActiveIdx] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  // Reset active index when suggestions change
  useEffect(() => { setActiveIdx(0) }, [suggestions.length, query])

  // Keyboard navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onDismiss(); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)); return }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); return }
      if (e.key === 'Enter' || e.key === 'Tab') {
        const target = suggestions[activeIdx]
        if (target) { e.preventDefault(); onSelect(target.title) }
        else onDismiss()
      }
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [suggestions, activeIdx, onSelect, onDismiss])

  // Click outside
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (listRef.current && !listRef.current.contains(e.target as Node)) onDismiss()
    }
    window.addEventListener('mousedown', onMouseDown)
    return () => window.removeEventListener('mousedown', onMouseDown)
  }, [onDismiss])

  const PANEL_W = 260
  const clampedX = Math.min(Math.max(x, 8), window.innerWidth - PANEL_W - 8)
  const clampedY = Math.min(y, window.innerHeight - 300)

  return createPortal(
    <div
      ref={listRef}
      role="listbox"
      aria-label="Note suggestions"
      style={{ left: clampedX, top: clampedY, width: PANEL_W }}
      className="fixed z-[9999] overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] shadow-2xl"
    >
      <div className="flex items-center gap-1.5 border-b border-[rgb(var(--border))] px-3 py-1.5">
        <Link2 size={11} className="text-[rgb(var(--accent))]" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--text-3))]">
          Link to note
        </span>
      </div>

      {suggestions.length === 0 ? (
        <div className="px-3 py-3 text-xs text-[rgb(var(--text-3))]">
          {query ? `No notes match "${query}"` : 'Start typing to search…'}
        </div>
      ) : (
        <ul role="presentation">
          {suggestions.map((note, i) => (
            <li key={note.id} role="option" aria-selected={i === activeIdx}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onSelect(note.title) }}
                onMouseEnter={() => setActiveIdx(i)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left transition ${
                  i === activeIdx
                    ? 'bg-[rgb(var(--accent)/0.08)] text-[rgb(var(--text))]'
                    : 'text-[rgb(var(--text-2))] hover:bg-[rgb(var(--surface-2))]'
                }`}
              >
                <FileText size={13} className="shrink-0 text-[rgb(var(--accent))]" />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {highlight(note.title, query)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-[rgb(var(--border))] px-3 py-1.5">
        <span className="text-[10px] text-[rgb(var(--text-3))]">
          ↑↓ navigate · Enter select · Esc dismiss
        </span>
      </div>
    </div>,
    document.body,
  )
}

function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-[rgb(var(--accent)/0.15)] text-[rgb(var(--accent))] rounded-sm not-italic">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}
