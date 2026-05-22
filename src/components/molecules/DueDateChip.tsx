
import { getDueState, formatDateShort } from '../../utils/kanban'
import { Icon } from '../../icons/Icon'

interface DueDateChipProps {
  due: string
  className?: string
}

const STATE_STYLES = {
  overdue: 'text-red-500',
  today: 'text-yellow-500',
  soon: 'text-[rgb(var(--text-2))]',
  normal: 'text-[rgb(var(--text-3))]',
}

export function DueDateChip({ due, className = '' }: DueDateChipProps): JSX.Element {
  const state = getDueState(due)
  const colorClass = STATE_STYLES[state]
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${colorClass} ${className}`}>
      <Icon name="calendar" size={11} />
      {formatDateShort(due)}
    </span>
  )
}
