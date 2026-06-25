import { ModalShell } from '../../molecules/ModalShell'
import { Button } from '../../atoms/Button'
import { Icon } from '../../../icons/Icon'
import { usePaneStore } from '../../../store/usePaneStore'
import { useUpgradeStore } from '../../../store/useUpgradeStore'
import { getUpgradeCopy } from '../../../tiers/upgradeCopy'
import { TIER_LIMITS } from '../../../tiers/tierLimits'

export function UpgradeModal(): JSX.Element | null {
  const reason  = useUpgradeStore((s) => s.activeReason)
  const dismiss = useUpgradeStore((s) => s.dismiss)

  if (!reason) return null

  const copy = getUpgradeCopy(reason)

  const goToPricing = () => {
    const { focusedPaneId, navigatePane } = usePaneStore.getState()
    navigatePane(focusedPaneId, '/pricing')
    dismiss()
  }

  return (
    <ModalShell onClose={dismiss} maxWidth="max-w-sm">
      <div className="p-6">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--accent)/0.12)]">
            <Icon name="zap" size={18} className="text-[rgb(var(--accent))]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[rgb(var(--text))]">{copy.title}</h2>
            <p className="mt-1 text-sm text-[rgb(var(--text-2))]">{copy.currentLimit}</p>
          </div>
        </div>

        {copy.targetTier ? (
          <div className="mb-5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[rgb(var(--text))]">
                {TIER_LIMITS[copy.targetTier].label}
              </span>
              <span className="text-sm text-[rgb(var(--text-2))]">
                ${copy.priceAnnual}/mo
              </span>
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-[rgb(var(--text-2))]">
              <Icon name="check" size={12} className="text-[rgb(var(--accent))]" />
              {copy.unlocks}
            </p>
          </div>
        ) : (
          <p className="mb-5 text-sm text-[rgb(var(--text-2))]">You're on the highest plan.</p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="hollow" size="md" onClick={dismiss}>Not now</Button>
          {copy.targetTier && (
            <Button variant="primary" size="md" onClick={goToPricing}>View plans</Button>
          )}
        </div>
      </div>
    </ModalShell>
  )
}
