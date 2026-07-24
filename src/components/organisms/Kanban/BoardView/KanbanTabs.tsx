import { useNavigate } from 'react-router-dom'
import { Icon } from '../../../../icons/Icon'
import type { IconToken } from '../../../../icons/tokens'
import type { Board, KanbanView } from '../../../../types/kanban.types'

const TABS: Array<{ id: KanbanView; label: string; icon: IconToken }> = [
  { id: 'summary',  label: 'Summary',  icon: 'layout-dashboard' },
  { id: 'timeline', label: 'Timeline', icon: 'calendar-days' },
  { id: 'backlog',  label: 'Backlog',  icon: 'layers' },
  { id: 'board',    label: 'Board',    icon: 'square-kanban' },
  { id: 'list',     label: 'List',     icon: 'layout-list' },
]

interface Props {
  board: Board
  view: KanbanView
  onSelect: (view: KanbanView) => void
}

/** Top navigation row: back to boards, board identity, and the view tabs. */
export function KanbanTabs({ board, view, onSelect }: Props): JSX.Element {
  const navigate = useNavigate()

  return (
    <div className="flex flex-shrink-0 items-center gap-1 border-b border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-2 md:px-3">
      <button
        onClick={() => navigate('/kanban')}
        className="mr-1 flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs text-[rgb(var(--text-3))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]"
        title="All boards"
      >
        <Icon name="arrow-left" size={13} />
      </button>

      <span className="flex items-center gap-1.5 pr-2 md:pr-3">
        <Icon name="square-kanban" size={14} className="text-[rgb(var(--accent))]" />
        <span className="max-w-[120px] truncate text-sm font-bold text-[rgb(var(--text))] md:max-w-[220px]">
          {board.title}
        </span>
      </span>

      <div className="h-5 w-px bg-[rgb(var(--border))]" />

      <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto overflow-y-hidden">
        {TABS.map(tab => {
          const active = view === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onSelect(tab.id)}
              className={`relative flex items-center gap-1.5 whitespace-nowrap px-2.5 py-2.5 text-[13px] font-medium transition md:px-3 ${
                active
                  ? 'text-[rgb(var(--text))]'
                  : 'text-[rgb(var(--text-3))] hover:text-[rgb(var(--text-2))]'
              }`}
            >
              <Icon name={tab.icon} size={14} />
              <span className="hidden sm:inline">{tab.label}</span>
              {active && (
                <span className="absolute inset-x-1.5 bottom-0 h-0.5 rounded-full bg-[rgb(var(--accent))]" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
