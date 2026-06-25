import { useEffect } from 'react'
import { SectionCard } from '../../molecules/SectionCard'
import { StorageBar } from '../../molecules/StorageBar'
import { StorageFileList } from './StorageFileList'
import { Button } from '../../atoms/Button'
import { IconButton } from '../../atoms/IconButton'
import { Icon } from '../../../icons/Icon'
import { usePaneStore } from '../../../store/usePaneStore'
import { useStorageStore } from '../../../store/useStorageStore'
import { useTier } from '../../../store/useTierStore'
import { getLimits } from '../../../tiers/tierProvider'
import { formatBytes } from '../../../tiers/checks'
import { TIER_LIMITS } from '../../../tiers/tierLimits'
import { openManageSubscription, openCancelSubscription } from '../../../tiers/billing'

function Breakdown({ notes, attachments, versions }: { notes: number; attachments: number; versions: number }): JSX.Element {
  const rows = [
    { label: 'Notes',       value: notes },
    { label: 'Attachments', value: attachments },
    { label: 'Versions',    value: versions },
  ]
  return (
    <div className="mt-4 grid grid-cols-3 gap-3">
      {rows.map((r) => (
        <div key={r.label} className="rounded-lg bg-[rgb(var(--surface-2))] px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-[rgb(var(--text-3))]">{r.label}</p>
          <p className="text-sm font-medium text-[rgb(var(--text-2))]">{formatBytes(r.value)}</p>
        </div>
      ))}
    </div>
  )
}

export function StorageSection(): JSX.Element {
  const tier          = useTier()
  const usage         = useStorageStore((s) => s.usage)
  const recalculating = useStorageStore((s) => s.recalculating)
  const recalculate   = useStorageStore((s) => s.recalculate)
  const limits        = getLimits(tier)

  useEffect(() => { void recalculate() }, [recalculate])

  const goToPricing = () => {
    const { focusedPaneId, navigatePane } = usePaneStore.getState()
    navigatePane(focusedPaneId, '/pricing')
  }

  const sync = usage?.sync
  const pct = sync && limits.syncStorageBytes > 0 && isFinite(limits.syncStorageBytes)
    ? (sync.total / limits.syncStorageBytes) * 100
    : 0
  const showPublish = limits.publishStorageBytes > 0

  return (
    <div className="space-y-4">
      <SectionCard title="Your Plan">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[rgb(var(--accent)/0.12)]">
              <Icon name="zap" size={16} className="text-[rgb(var(--accent))]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[rgb(var(--text))]">{TIER_LIMITS[tier].label}</p>
              <p className="text-xs text-[rgb(var(--text-3))]">
                Max file size {limits.fileSizeBytes === Infinity ? 'unlimited' : formatBytes(limits.fileSizeBytes)}
              </p>
            </div>
          </div>
          {tier === 'free' ? (
            <Button variant="primary" size="md" onClick={goToPricing}>View Plans</Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="danger" size="md" onClick={() => void openCancelSubscription()}>Cancel</Button>
              <Button variant="hollow" size="md" onClick={() => void openManageSubscription()}>Manage Subscription</Button>
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Sync Storage">
        <div className="mb-2 flex items-center justify-end">
          <IconButton icon="refresh-cw" label="Recalculate" size="sm" onClick={() => void recalculate()} iconClassName={recalculating ? 'animate-spin' : ''} />
        </div>
        {limits.syncStorageBytes === 0 ? (
          <p className="text-sm text-[rgb(var(--text-2))]">
            You're on a local-only plan. Upgrade to sync your vault across devices.
          </p>
        ) : (
          <>
            {pct >= 100 && (
              <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-500">
                Storage full — new changes won't sync. Free up space or upgrade your plan.
              </div>
            )}
            {pct >= 80 && pct < 100 && (
              <div className="mb-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-600">
                You're running low on sync storage ({Math.round(pct)}% used).
              </div>
            )}
            <StorageBar used={sync?.total ?? 0} total={limits.syncStorageBytes} />
            {sync && <Breakdown notes={sync.notes} attachments={sync.attachments} versions={sync.versions} />}
          </>
        )}
      </SectionCard>

      {showPublish && (
        <SectionCard title="Publish Storage">
          <StorageBar used={usage?.publish.total ?? 0} total={limits.publishStorageBytes} />
        </SectionCard>
      )}

      <SectionCard title="Largest Notes">
        <StorageFileList />
      </SectionCard>
    </div>
  )
}
