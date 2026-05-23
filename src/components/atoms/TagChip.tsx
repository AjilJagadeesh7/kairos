import type { TagRecord } from '../../types'
import { tagTextColor } from '../../utils/kanban'

interface TagChipProps {
  tag: TagRecord
  selected?: boolean
  onClick?: () => void
  onRemove?: () => void
  className?: string
}

export function TagChip({ tag, selected = false, onClick, onRemove, className = '' }: TagChipProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition ${
        selected ? 'ring-2 ring-offset-2 ring-offset-surface2' : 'opacity-80 hover:opacity-100'
      } ${className}`}
      style={{ backgroundColor: tag.color, color: tagTextColor(tag.color) }}
    >
      <span>#{tag.name}</span>
      {onRemove && (
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-black/10 text-[10px] transition hover:bg-black/20" style={{ color: 'inherit' }}>
          ×
        </span>
      )}
    </button>
  )
}
