import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAppStore } from '../../../store/useAppStore'
import { useBacklinks } from '../../../hooks/useBacklinks'
import { Icon } from '../../../icons/Icon'

interface Props {
  noteTitle: string
}

export function BacklinksPanel({ noteTitle }: Props) {
  const notes    = useAppStore(s => s.notes)
  const navigate = useNavigate()
  const backlinks = useBacklinks(noteTitle, notes)

  const [open, setOpen] = useState(backlinks.length > 0)

  // Stay expanded if backlinks appear after mount
  const hasLinks = backlinks.length > 0

  return (
    <div className="mt-2 border-t border-border">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-2 px-1 py-2 text-xs font-semibold uppercase tracking-widest text-text3 hover:text-text2 transition-colors"
      >
        {open ? <Icon name="chevron-down" size={12} /> : <Icon name="chevron-right" size={12} />}
        <Icon name="link" size={11} />
        Backlinks
        <span className="ml-1 rounded-full bg-surface2 px-1.5 py-0.5 text-[10px] font-normal normal-case tracking-normal">
          {backlinks.length}
        </span>
      </button>

      {open && (
        <div className="pb-4 pt-1">
          {!hasLinks ? (
            <p className="px-1 text-xs italic text-text3">No notes link here yet.</p>
          ) : (
            <ul className="space-y-2">
              {backlinks.map(({ note, context }) => (
                <li key={note.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/notes/${note.id}`)}
                    className="group w-full rounded-lg border border-border bg-surface2 px-3 py-2 text-left transition hover:border-accent/40 hover:bg-surface"
                  >
                    <p className="text-sm font-medium text-text group-hover:text-accent transition-colors">
                      {note.title || 'Untitled note'}
                    </p>
                    {context && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-text3">{context}</p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
