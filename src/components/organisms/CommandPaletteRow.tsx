import type { IconToken } from '../../icons/tokens'
import { Icon } from '../../icons/Icon'
import { todayDate } from '../../store/useJournalStore'
import type { ResultItem } from './commandPaletteItems'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function formatJournalDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const monthLabel = MONTHS[(m ?? 1) - 1] ?? ''
  const today = todayDate()
  if (date === today) return 'Today'
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  if (date === yesterday) return 'Yesterday'
  return `${monthLabel} ${d}, ${y}`
}

function excerpt(content: string, maxLen = 80): string {
  const stripped = content.replace(/[#*`_~\[\]]/g, '').replace(/\s+/g, ' ').trim()
  return stripped.length > maxLen ? stripped.slice(0, maxLen) + '…' : stripped
}

function rowContent(item: ResultItem): { iconName: IconToken; primary: string; secondary?: string } {
  if (item.kind === 'note')    return { iconName: 'file-text',     primary: item.note.title || 'Untitled note', secondary: item.note.folder }
  if (item.kind === 'journal') return { iconName: 'calendar-days', primary: formatJournalDate(item.entry.date), secondary: excerpt(item.entry.content) }
  if (item.kind === 'task')    return { iconName: 'check-square',  primary: item.task.title, secondary: item.board.title }
  if (item.kind === 'canvas')  return { iconName: 'pen-tool',      primary: item.canvas.title || 'Untitled canvas', secondary: 'Canvas' }
  if (item.kind === 'pennote') return { iconName: 'pen-line',      primary: item.penNote.title || 'Untitled pen note', secondary: item.penNote.folder || 'Pen note' }
  return { iconName: item.iconName, primary: item.label, secondary: item.hint }
}

interface RowProps {
  item: ResultItem
  idx: number
  isActive: boolean
  onHover: () => void
  onClick: () => void
}

export function ResultRow({ item, idx, isActive, onHover, onClick }: RowProps) {
  const { iconName, primary, secondary } = rowContent(item)
  const bg = isActive ? 'bg-accent/15' : 'hover:bg-surface2'

  return (
    <li
      role="option"
      aria-selected={isActive}
      data-idx={idx}
      onMouseEnter={onHover}
      onClick={onClick}
      className={`flex cursor-pointer items-center gap-3 px-4 py-2 transition-colors ${bg}`}
    >
      <Icon name={iconName} size={14} className={`shrink-0 ${isActive ? 'text-accent' : 'text-text3'}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-text">{primary}</p>
        {secondary && (
          item.kind === 'note' && item.note.folder
            ? <p className="flex items-center gap-1 truncate text-[11px] text-text3"><Icon name="folder-open" size={10} aria-hidden />{secondary}</p>
            : <p className="truncate text-[11px] text-text3">{secondary}</p>
        )}
      </div>
      {isActive && <Icon name="corner-down-left" size={12} className="shrink-0 text-text3" aria-hidden />}
    </li>
  )
}

export function SectionLabel({ label }: { label: string }) {
  return (
    <li className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-text3">
      {label}
    </li>
  )
}
