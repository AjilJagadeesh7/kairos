import { useEffect } from 'react'
import { Checkbox } from '../atoms/Checkbox'
import { Button } from '../atoms/Button'
import { IconButton } from '../atoms/IconButton'
import { useSelectionStore } from '../../store/useSelectionStore'
import type { SelectionScope } from '../../types'

interface Props {
  scope: SelectionScope
  /** Singular noun, e.g. "note". */
  noun: string
  /** Plural, when adding "s" is wrong — "canvas" → "canvases". */
  plural?: string
  onDelete: () => void
  onExit: () => void
}

/**
 * Bar shown above a sidebar list while it is in selection mode: select-all,
 * a live count, and the bulk actions.
 */
export function SelectionToolbar({ scope, noun, plural, onDelete, onExit }: Props): JSX.Element {
  const count = useSelectionStore(s => (s.scope === scope ? s.ids.size : 0))
  const total = useSelectionStore(s => s.order.length)
  const selectAll = useSelectionStore(s => s.selectAll)
  const clear     = useSelectionStore(s => s.clear)

  const many = plural ?? `${noun}s`
  const allSelected = total > 0 && count === total

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onExit() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onExit])

  return (
    <div className="flex items-center gap-2 border-b border-border bg-accent/[0.06] px-3 py-2">
      <Checkbox
        checked={allSelected}
        indeterminate={count > 0 && !allSelected}
        label={allSelected ? `Deselect all ${many}` : `Select all ${many}`}
        onChange={() => (allSelected ? clear() : selectAll())}
      />

      <span className="min-w-0 flex-1 truncate text-[11px] text-text2">
        {count === 0
          ? `Select ${many}`
          : `${count} of ${total} selected`}
      </span>

      <Button
        variant="danger"
        size="xs"
        disabled={count === 0}
        onClick={onDelete}
      >
        Delete
      </Button>

      <IconButton icon="x" label="Cancel selection" size="xs" onClick={onExit} />
    </div>
  )
}
