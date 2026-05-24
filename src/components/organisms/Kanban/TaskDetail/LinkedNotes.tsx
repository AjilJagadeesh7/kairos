import { useState } from 'react'

import { useAppStore } from '../../../../store/useAppStore'
import { useKanbanStore } from '../../../../store/useKanbanStore'
import { usePaneStore } from '../../../../store/usePaneStore'
import type { KanbanTask } from '../../../../types/kanban.types'
import { Icon } from '../../../../icons/Icon'

interface Props {
  boardId: string
  task: KanbanTask
}

export function LinkedNotes({ boardId, task }: Props): JSX.Element {
  const [searching, setSearching] = useState(false)
  const [query, setQuery]         = useState('')
  const updateTask = useKanbanStore(s => s.updateTask)
  const allNotes   = useAppStore(s => s.notes)

  const linkedNotes = task.linkedNotes
    .map(id => allNotes.find(n => n.id === id))
    .filter(Boolean) as Array<{ id: string; title: string; updatedAt: string }>

  const candidates = allNotes.filter(n => {
    if (task.linkedNotes.includes(n.id)) return false
    const q = query.toLowerCase()
    return !q || n.title.toLowerCase().includes(q)
  })

  function link(noteId: string) {
    updateTask(boardId, task.id, { linkedNotes: [...task.linkedNotes, noteId] })
    setSearching(false)
    setQuery('')
  }

  function unlink(noteId: string) {
    updateTask(boardId, task.id, { linkedNotes: task.linkedNotes.filter(id => id !== noteId) })
  }

  function openNote(noteId: string) {
    const { focusedPaneId, navigatePane } = usePaneStore.getState()
    navigatePane(focusedPaneId, `/notes/${noteId}`)
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {linkedNotes.map(note => (
        <div
          key={note.id}
          className="group flex items-center gap-1.5 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] pl-2 pr-1 py-1 transition-colors hover:border-[rgb(var(--accent))]/40 hover:bg-[rgb(var(--surface-3))]"
        >
          <Icon name="file-text" size={11} className="shrink-0 text-[rgb(var(--accent))]" />
          <span className="max-w-[140px] truncate text-[12px] font-medium text-[rgb(var(--text))]">
            {note.title || 'Untitled'}
          </span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => openNote(note.id)}
              title="Open note"
              className="rounded-full p-1 text-[rgb(var(--text-3))] transition hover:text-[rgb(var(--accent))]"
            >
              <Icon name="arrow-up-right" size={10} />
            </button>
            <button
              onClick={() => unlink(note.id)}
              title="Unlink"
              className="rounded-full p-1 text-[rgb(var(--text-3))] transition hover:text-red-500"
            >
              <Icon name="x" size={10} />
            </button>
          </div>
        </div>
      ))}

      {searching ? (
        <div className="relative">
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Escape' && (setSearching(false), setQuery(''))}
            placeholder="Search notes…"
            className="w-full rounded-lg border border-[rgb(var(--accent))]/60 bg-[rgb(var(--surface-2))] px-3 py-2 text-[13px] text-[rgb(var(--text))] outline-none placeholder-[rgb(var(--text-3))]"
          />
          {candidates.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] shadow-xl">
              {candidates.slice(0, 8).map(note => (
                <button
                  key={note.id}
                  onClick={() => link(note.id)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-[rgb(var(--text))] transition hover:bg-[rgb(var(--surface-2))]"
                >
                  <Icon name="file-text" size={12} className="shrink-0 text-[rgb(var(--text-3))]" />
                  <span className="truncate">{note.title || 'Untitled'}</span>
                </button>
              ))}
            </div>
          )}
          {candidates.length === 0 && query && (
            <p className="mt-1.5 text-center text-xs text-[rgb(var(--text-3))]">No notes found</p>
          )}
        </div>
      ) : (
        <button
          onClick={() => setSearching(true)}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-[rgb(var(--text-3))] transition hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--accent))]"
        >
          <Icon name="plus" size={12} /> Link note
        </button>
      )}
    </div>
  )
}
