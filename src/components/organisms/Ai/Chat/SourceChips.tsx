import { useNavigate } from 'react-router-dom'
import { Icon } from '../../../../icons/Icon'
import type { ChatSourceRef } from '../../../../types'

/** Where a source chip leads: the note, the journal day, or the card's page. */
function sourcePath(s: ChatSourceRef): string {
  if (s.kind === 'note') return `/notes/${s.id}`
  if (s.kind === 'journal') return `/journal/${s.id}`
  return s.boardId ? `/kanban/${s.boardId}/${s.id}` : '/kanban'
}

/** Tappable chips for the notes and cards an answer drew from (PRD). */
export function SourceChips({ sources }: { sources: ChatSourceRef[] }) {
  const navigate = useNavigate()
  if (!sources.length) return null
  return (
    <div className="flex flex-wrap gap-1" aria-label="Sources">
      {sources.map((s) => (
        <button
          key={`${s.kind}:${s.id}`}
          type="button"
          onClick={() => navigate(sourcePath(s))}
          title={`Open ${s.title}`}
          className="flex max-w-[220px] items-center gap-1 rounded-md border border-border bg-bg px-1.5 py-0.5 text-[11px] text-text2 hover:border-accent hover:text-text"
        >
          {s.n !== undefined && <span className="font-mono text-[10px] text-text3">[{s.n}]</span>}
          <Icon name={s.kind === 'card' ? 'square-kanban' : s.kind === 'journal' ? 'calendar-days' : 'file-text'} size={11} className="shrink-0" />
          <span className="truncate">{s.title}</span>
        </button>
      ))}
    </div>
  )
}
