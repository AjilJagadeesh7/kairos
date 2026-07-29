import { Icon } from '../../icons/Icon'
import { ISSUE_TYPE_META } from '../../utils/kanban'
import type { IssueType } from '../../types/kanban.types'

interface Props {
  type: IssueType
  size?: number
  className?: string
}

/** Colored, square badge for a Jira-style issue type (story/task/bug/subtask). */
export function IssueTypeIcon({ type, size = 16, className = '' }: Props): JSX.Element {
  const meta = ISSUE_TYPE_META[type] ?? ISSUE_TYPE_META.task
  return (
    <span
      className={`inline-flex flex-shrink-0 items-center justify-center rounded ${className}`}
      style={{ width: size, height: size, backgroundColor: `${meta.color}22`, color: meta.color }}
      title={meta.label}
      aria-label={meta.label}
    >
      <Icon name={meta.icon} size={Math.round(size * 0.7)} />
    </span>
  )
}
