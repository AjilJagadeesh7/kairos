import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../../store/useAppStore'
import { useTrashStore } from '../../../store/useTrashStore'
import { useConfirmStore } from '../../../store/useConfirmStore'
import { SectionCard } from '../../molecules/SectionCard'
import { Button } from '../../atoms/Button'
import { Pill } from '../../atoms/Pill'
import { Icon } from '../../../icons/Icon'
import { TRASH_RETENTION_PRESETS } from '../../../types'

/** Retention window for the trash + a shortcut to review or empty it. */
export function TrashRetentionCard(): JSX.Element {
  const retentionDays    = useAppStore(s => s.trashRetentionDays)
  const setRetentionDays = useAppStore(s => s.setTrashRetentionDays)
  const items            = useTrashStore(s => s.items)
  const loadTrash        = useTrashStore(s => s.loadTrash)
  const emptyAll         = useTrashStore(s => s.emptyAll)
  const confirm          = useConfirmStore(s => s.confirm)
  const navigate         = useNavigate()

  useEffect(() => { void loadTrash() }, [loadTrash])

  async function handleEmpty() {
    const ok = await confirm({
      title: `Permanently delete all ${items.length} item${items.length === 1 ? '' : 's'}?`,
      message: 'Everything in the trash will be gone for good. This cannot be undone.',
      confirmLabel: 'Empty trash',
      danger: true,
    })
    if (ok) await emptyAll()
  }

  return (
    <SectionCard title="Trash">
      <p className="mb-3 text-xs text-[rgb(var(--text-2))]">
        Deleted notes, journal entries, boards, canvases, pen notes and attachments are kept
        here so you can restore them. Pick how long they survive before they are purged
        automatically — the timer runs at startup and hourly while the app is open.
      </p>

      <div className="flex flex-wrap gap-1.5">
        {TRASH_RETENTION_PRESETS.map(preset => (
          <Pill
            key={preset.days}
            selected={retentionDays === preset.days}
            onClick={() => setRetentionDays(preset.days)}
          >
            {preset.label}
          </Pill>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[rgb(var(--border))] pt-3">
        <span className="mr-auto text-xs text-[rgb(var(--text-3))]">
          {items.length === 0
            ? 'Trash is empty'
            : `${items.length} item${items.length === 1 ? '' : 's'} in the trash`}
        </span>
        <Button variant="hollow" size="sm" onClick={() => navigate('/trash')}>
          <Icon name="trash-2" size={12} /> Open trash
        </Button>
        {items.length > 0 && (
          <Button variant="danger" size="sm" onClick={() => void handleEmpty()}>
            Empty now
          </Button>
        )}
      </div>
    </SectionCard>
  )
}
