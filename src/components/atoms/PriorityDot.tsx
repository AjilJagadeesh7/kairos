import { PRIORITY_COLORS } from '../../utils/kanban'
import type { Priority } from '../../types/kanban.types'

interface PriorityDotProps {
  priority: Priority | null
  size?: number
  showLabel?: boolean
}

const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}

export function PriorityDot({ priority, size = 8, showLabel = false }: PriorityDotProps): JSX.Element | null {
  if (!priority) return null
  const color = PRIORITY_COLORS[priority]
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block flex-shrink-0 rounded-full"
        style={{ width: size, height: size, backgroundColor: color }}
        aria-label={`Priority: ${PRIORITY_LABELS[priority]}`}
      />
      {showLabel && (
        <span className="text-xs" style={{ color }}>
          {PRIORITY_LABELS[priority]}
        </span>
      )}
    </span>
  )
}
