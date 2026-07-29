import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../../store/useAppStore'
import { useJournalStore } from '../../../store/useJournalStore'
import { useKanbanStore } from '../../../store/useKanbanStore'
import { usePenNoteStore } from '../../../store/usePenNoteStore'
import { useCanvasStore } from '../../../store/useCanvasStore'
import { useAttachmentStore } from '../../../store/useAttachmentStore'
import { SectionLabel } from '../../atoms/SectionLabel'
import { Icon } from '../../../icons/Icon'
import { timeAgo } from '../../../utils/timeAgo'
import type { IconToken } from '../../../icons/tokens'

interface RecentItem {
  id: string
  kind: string
  title: string
  subtitle?: string
  path: string
  iconName: IconToken
  updatedAt: string
}

function journalLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  if (!y || !m || !d) return date
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

const plain = (s: string) => s.replace(/[#*`[\]!>_~-]/g, '').trim()

/** Unified "recently touched" feed across every content type, so the newest
 *  work — whatever kind — is one tap away from home. */
export function RecentActivity(): JSX.Element | null {
  const navigate    = useNavigate()
  const notes       = useAppStore(s => s.notes)
  const entries     = useJournalStore(s => s.entries)
  const boards      = useKanbanStore(s => s.boards)
  const penNotes    = usePenNoteStore(s => s.penNotes)
  const canvases    = useCanvasStore(s => s.canvases)
  const attachments = useAttachmentStore(s => s.attachments)

  const items = useMemo<RecentItem[]>(() => {
    const all: RecentItem[] = []
    for (const n of notes)
      all.push({ id: n.id, kind: 'Note', iconName: 'book-open', title: n.title || 'Untitled note', subtitle: n.content ? plain(n.content).slice(0, 70) : undefined, path: `/notes/${n.id}`, updatedAt: n.updatedAt })
    for (const e of Object.values(entries))
      all.push({ id: e.date, kind: 'Journal', iconName: 'calendar-days', title: journalLabel(e.date), subtitle: e.content ? plain(e.content).slice(0, 70) : undefined, path: `/journal/${e.date}`, updatedAt: e.updatedAt })
    for (const b of boards)
      all.push({ id: b.id, kind: 'Board', iconName: 'square-kanban', title: b.title, subtitle: `${b.tasks.length} issue${b.tasks.length === 1 ? '' : 's'}`, path: `/kanban/${b.id}`, updatedAt: b.updatedAt })
    for (const p of penNotes)
      all.push({ id: p.id, kind: 'Pen note', iconName: 'pen-line', title: p.title || 'Untitled pen note', path: `/pennote/${p.id}`, updatedAt: p.updatedAt })
    for (const c of canvases)
      all.push({ id: c.id, kind: 'Canvas', iconName: 'pen-tool', title: c.title || 'Untitled canvas', path: `/canvas/${c.id}`, updatedAt: c.updatedAt })
    for (const a of attachments)
      all.push({ id: a.id, kind: 'Attachment', iconName: 'paperclip', title: a.name, path: `/attachments/${a.id}`, updatedAt: a.updatedAt })

    return all
      .filter(i => i.updatedAt)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 8)
  }, [notes, entries, boards, penNotes, canvases, attachments])

  if (items.length === 0) return null

  return (
    <section>
      <SectionLabel className="mb-3">Jump back in</SectionLabel>
      <div className="flex flex-col gap-1.5">
        {items.map(i => (
          <button
            key={`${i.kind}:${i.id}`}
            onClick={() => navigate(i.path)}
            className="group flex items-center gap-3 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-2.5 text-left transition hover:border-[rgb(var(--accent))] hover:shadow-sm"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--surface-2))] text-[rgb(var(--text-3))] transition group-hover:text-[rgb(var(--accent))]">
              <Icon name={i.iconName} size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[rgb(var(--text))]">{i.title}</p>
              <p className="truncate text-xs text-[rgb(var(--text-3))]">
                <span className="text-[rgb(var(--text-2))]">{i.kind}</span>
                {i.subtitle ? ` · ${i.subtitle}` : ''}
              </p>
            </div>
            <span className="shrink-0 text-xs text-[rgb(var(--text-3))]">{timeAgo(i.updatedAt)}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
