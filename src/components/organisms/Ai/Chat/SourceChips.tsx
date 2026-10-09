import { useNavigate } from 'react-router-dom'
import { Icon } from '../../../../icons/Icon'
import { openExternal } from '../../../../utils/openExternal'
import type { ChatSourceRef } from '../../../../types'

/** Where a source chip leads: the note, the journal day, or the card's page. */
function sourcePath(s: ChatSourceRef): string {
  if (s.kind === 'note') return `/notes/${s.id}`
  if (s.kind === 'journal') return `/journal/${s.id}`
  return s.boardId ? `/kanban/${s.boardId}/${s.id}` : '/kanban'
}

const ICON = { card: 'square-kanban', journal: 'calendar-days', note: 'file-text', web: 'globe' } as const

function host(url: string): string {
  try { return new URL(url).host.replace(/^www\./, '') } catch { return url }
}

/** Tappable chips for the notes, cards and web pages an answer drew from (PRD). Web chips open in the browser. */
export function SourceChips({ sources }: { sources: ChatSourceRef[] }) {
  const navigate = useNavigate()
  if (!sources.length) return null
  return (
    <div className="flex flex-wrap gap-1" aria-label="Sources">
      {sources.map((s) => (
        <button
          key={`${s.kind}:${s.id}`}
          type="button"
          onClick={() => (s.kind === 'web' ? void openExternal(s.id) : navigate(sourcePath(s)))}
          title={s.kind === 'web' ? s.id : `Open ${s.title}`}
          className="flex max-w-[220px] items-center gap-1 rounded-md border border-border bg-bg px-1.5 py-0.5 text-[11px] text-text2 hover:border-accent hover:text-text"
        >
          {s.n !== undefined && <span className="font-mono text-[10px] text-text3">[{s.n}]</span>}
          <Icon name={ICON[s.kind]} size={11} className="shrink-0" />
          <span className="truncate">{s.kind === 'web' ? `${s.title} · ${host(s.id)}` : s.title}</span>
        </button>
      ))}
    </div>
  )
}
