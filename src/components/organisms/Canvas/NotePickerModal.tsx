import { useMemo, useState } from 'react'
import { useAppStore } from '../../../store/useAppStore'
import { Icon } from '../../../icons/Icon'

interface NotePickerModalProps {
  onPick: (noteId: string, title: string) => void
  onClose: () => void
}

export function NotePickerModal({ onPick, onClose }: NotePickerModalProps) {
  const notes = useAppStore(s => s.notes)
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return q ? notes.filter(n => (n.title || 'Untitled').toLowerCase().includes(q)) : notes
  }, [notes, query])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onMouseDown={onClose}>
      <div className="w-[400px] overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] shadow-2xl" onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-[rgb(var(--border))] px-3 py-2">
          <Icon name="search" size={14} className="text-[rgb(var(--text-3))]" />
          <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search notes…"
            className="flex-1 bg-transparent text-[13px] text-[rgb(var(--text))] outline-none placeholder:text-[rgb(var(--text-3))]" />
        </div>
        <div className="max-h-[320px] overflow-y-auto py-1">
          {filtered.length === 0
            ? <p className="px-4 py-6 text-center text-[12px] text-[rgb(var(--text-3))]">No notes found</p>
            : filtered.slice(0, 40).map(note => (
                <button key={note.id} type="button" onClick={() => onPick(note.id, note.title || 'Untitled')}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-[13px] text-[rgb(var(--text))] transition hover:bg-[rgb(var(--surface-2))]">
                  <Icon name="file-text" size={13} className="shrink-0 text-[rgb(var(--accent))]" />
                  <span className="truncate">{note.title || 'Untitled'}</span>
                </button>
              ))
          }
        </div>
      </div>
    </div>
  )
}
