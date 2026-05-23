
import type { TagRecord } from '../../types'
import { Icon } from '../../icons/Icon'
import { tagTextColor } from '../../utils/kanban'

interface TagBadgeProps {
  tag: TagRecord
  onRemove?: () => void
  variant?: 'sm' | 'md'
}

export function TagBadge({ tag, onRemove, variant = 'sm' }: TagBadgeProps): JSX.Element {
  const sizeClass = variant === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
  const iconSize = variant === 'sm' ? 12 : 14

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeClass}`}
      style={{ backgroundColor: tag.color, color: tagTextColor(tag.color) }}
    >
      #{tag.name}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="ml-0.5 flex items-center justify-center rounded transition hover:opacity-75 active:scale-95"
          title="Remove tag"
        >
          <Icon name="x" size={iconSize} />
        </button>
      )}
    </div>
  )
}
