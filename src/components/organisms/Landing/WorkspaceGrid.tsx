import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../../store/useAppStore'
import { useJournalStore, todayDate } from '../../../store/useJournalStore'
import { useKanbanStore } from '../../../store/useKanbanStore'
import { usePenNoteStore } from '../../../store/usePenNoteStore'
import { useCanvasStore } from '../../../store/useCanvasStore'
import { useAttachmentStore } from '../../../store/useAttachmentStore'
import { SectionLabel } from '../../atoms/SectionLabel'
import { Icon } from '../../../icons/Icon'
import type { IconToken } from '../../../icons/tokens'

interface Tile {
  label: string
  iconName: IconToken
  count: number | null
  path: string
  hint: string
}

/** Overview grid of every content type — one tile per feature, with live counts,
 *  so the home screen reflects the whole workspace (notes → attachments). */
export function WorkspaceGrid(): JSX.Element {
  const navigate    = useNavigate()
  const notes       = useAppStore(s => s.notes)
  const entries     = useJournalStore(s => s.entries)
  const boards      = useKanbanStore(s => s.boards)
  const penNotes    = usePenNoteStore(s => s.penNotes)
  const canvases    = useCanvasStore(s => s.canvases)
  const attachments = useAttachmentStore(s => s.attachments)

  const tiles: Tile[] = [
    { label: 'Notes',       iconName: 'book-open',     count: notes.length,                 path: '/notes',                  hint: 'Markdown & wikilinks' },
    { label: 'Journal',     iconName: 'calendar-days', count: Object.keys(entries).length,  path: `/journal/${todayDate()}`, hint: 'Daily entries' },
    { label: 'Kanban',      iconName: 'square-kanban', count: boards.length,                path: '/kanban',                 hint: 'Issues, sprints & views' },
    { label: 'Pen Notes',   iconName: 'pen-line',      count: penNotes.length,              path: '/pennote',                hint: 'Handwriting & sketches' },
    { label: 'Canvas',      iconName: 'pen-tool',      count: canvases.length,              path: '/canvas',                 hint: 'Infinite whiteboard' },
    { label: 'Attachments', iconName: 'paperclip',     count: attachments.length,           path: '/attachments',            hint: 'Files & images' },
    { label: 'Graph',       iconName: 'network',       count: null,                         path: '/graph',                  hint: 'Explore connections' },
  ]

  return (
    <section>
      <SectionLabel className="mb-3">Workspace</SectionLabel>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {tiles.map(t => (
          <button
            key={t.path}
            onClick={() => navigate(t.path)}
            className="group flex flex-col gap-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-3 text-left transition hover:border-[rgb(var(--accent))] hover:shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[rgb(var(--accent)/0.1)] text-[rgb(var(--accent))] transition group-hover:bg-[rgb(var(--accent)/0.15)]">
                <Icon name={t.iconName} size={18} />
              </span>
              {t.count !== null
                ? <span className="text-lg font-bold tabular-nums text-[rgb(var(--text))]">{t.count}</span>
                : <Icon name="arrow-up-right" size={15} className="text-[rgb(var(--text-3))] transition group-hover:text-[rgb(var(--accent))]" />}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[rgb(var(--text))]">{t.label}</p>
              <p className="truncate text-xs text-[rgb(var(--text-3))]">{t.hint}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
