import { useAppStore } from '../../../store/useAppStore'
import { useTrashStore } from '../../../store/useTrashStore'
import { useConfirmStore } from '../../../store/useConfirmStore'
import { expiryOf } from '../../../trash/trashService'
import { timeAgo } from '../../../utils/timeAgo'
import { Icon } from '../../../icons/Icon'
import { IconButton } from '../../atoms/IconButton'
import { TRASH_KIND_META, timeUntil } from './trashMeta'
import type { TrashItem } from '../../../types'

export function TrashRow({ item }: { item: TrashItem }): JSX.Element {
  const retentionDays = useAppStore(s => s.trashRetentionDays)
  const restore       = useTrashStore(s => s.restore)
  const purge         = useTrashStore(s => s.purge)
  const busy          = useTrashStore(s => s.busyIds.includes(item.id))
  const confirm       = useConfirmStore(s => s.confirm)

  const meta    = TRASH_KIND_META[item.kind]
  const expires = timeUntil(expiryOf(item, retentionDays))

  async function handlePurge() {
    const ok = await confirm({
      title: `Delete "${item.title}" permanently?`,
      message: 'This cannot be undone.',
      confirmLabel: 'Delete forever',
      danger: true,
    })
    if (ok) await purge(item.id)
  }

  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-surface2 px-3 py-2.5 transition hover:border-accent/30">
      <Icon name={meta.icon} size={17} className="shrink-0 text-text3" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-text">{item.title}</p>
        <p className="truncate text-xs text-text3">
          {meta.label}
          {item.subtitle ? ` · ${item.subtitle}` : ''}
          {` · deleted ${timeAgo(item.deletedAt)}`}
        </p>
      </div>

      {expires && (
        <span
          className="hidden shrink-0 rounded-full bg-surface3 px-2 py-0.5 text-[10px] uppercase tracking-wider text-text3 sm:inline"
          title="When the retention timer purges this item"
        >
          purges {expires}
        </span>
      )}

      <div className="flex shrink-0 items-center gap-1">
        <IconButton
          icon="rotate-ccw"
          label={`Restore ${item.title}`}
          title="Restore"
          size="sm"
          disabled={busy}
          iconClassName={busy ? 'animate-spin' : undefined}
          onClick={() => void restore(item.id)}
        />
        <IconButton
          icon="trash-2"
          label={`Delete ${item.title} permanently`}
          title="Delete forever"
          size="sm"
          disabled={busy}
          className="hover:!bg-red-500/10 hover:!text-red-400"
          onClick={() => void handlePurge()}
        />
      </div>
    </li>
  )
}
