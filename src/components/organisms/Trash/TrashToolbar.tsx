import { useAppStore } from '../../../store/useAppStore'
import { useTrashStore } from '../../../store/useTrashStore'
import { useConfirmStore } from '../../../store/useConfirmStore'
import { Button } from '../../atoms/Button'
import { Pill } from '../../atoms/Pill'
import { Icon } from '../../../icons/Icon'
import { TRASH_KIND_META, TRASH_KIND_ORDER, retentionLabel } from './trashMeta'
import type { TrashKind } from '../../../types'

interface TrashToolbarProps {
  filter: TrashKind | 'all'
  onFilterChange: (f: TrashKind | 'all') => void
  counts: Record<string, number>
  total: number
}

export function TrashToolbar({ filter, onFilterChange, counts, total }: TrashToolbarProps): JSX.Element {
  const retentionDays = useAppStore(s => s.trashRetentionDays)
  const emptyAll      = useTrashStore(s => s.emptyAll)
  const confirm       = useConfirmStore(s => s.confirm)

  async function handleEmpty() {
    const ok = await confirm({
      title: `Permanently delete all ${total} item${total === 1 ? '' : 's'}?`,
      message: 'Everything in the trash will be gone for good. This cannot be undone.',
      confirmLabel: 'Empty trash',
      danger: true,
    })
    if (ok) await emptyAll()
  }

  return (
    <div className="border-b border-border px-6 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-base font-semibold text-text">
            <Icon name="trash-2" size={17} className="text-text3" />
            Trash
          </h1>
          <p className="mt-0.5 text-xs text-text3">
            {total === 0
              ? 'Nothing here — deleted items land in the trash first.'
              : `${total} item${total === 1 ? '' : 's'} · ${retentionLabel(retentionDays)}`}
          </p>
        </div>

        {total > 0 && (
          <Button variant="danger" size="sm" onClick={() => void handleEmpty()}>
            <Icon name="trash-2" size={13} /> Empty trash
          </Button>
        )}
      </div>

      {total > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Pill selected={filter === 'all'} onClick={() => onFilterChange('all')}>
            All {total}
          </Pill>
          {TRASH_KIND_ORDER.filter(k => counts[k] > 0).map(kind => (
            <Pill key={kind} selected={filter === kind} onClick={() => onFilterChange(kind)}>
              {TRASH_KIND_META[kind].label} {counts[kind]}
            </Pill>
          ))}
        </div>
      )}
    </div>
  )
}
