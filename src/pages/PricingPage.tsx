import { Icon } from '../icons/Icon'
import { Button } from '../components/atoms/Button'
import { useTier, useTierStore } from '../store/useTierStore'
import { TIER_LIMITS, TIER_ORDER } from '../tiers/tierLimits'
import { formatBytes } from '../tiers/checks'
import type { KairosTier, TierLimits } from '../types'

function featureRows(t: TierLimits): { label: string; value: string }[] {
  return [
    { label: 'Sync storage',   value: t.syncStorageBytes === 0 ? 'Local only' : formatBytes(t.syncStorageBytes) },
    { label: 'Publish storage', value: t.publishStorageBytes === 0 ? '—' : formatBytes(t.publishStorageBytes) },
    { label: 'Max file size',  value: t.fileSizeBytes === Infinity ? 'Unlimited' : formatBytes(t.fileSizeBytes) },
    { label: 'Version history', value: t.historyMonths === Infinity ? 'Unlimited' : `${t.historyMonths} mo / ${t.historyMaxVersions}` },
    { label: 'Vaults',         value: t.vaults === Infinity ? 'Unlimited' : String(t.vaults) },
  ]
}

function PlanCard({ tier, current, onSelect }: { tier: KairosTier; current: boolean; onSelect: () => void }): JSX.Element {
  const t = TIER_LIMITS[tier]
  return (
    <div className={`flex flex-col rounded-2xl border p-5 ${current ? 'border-[rgb(var(--accent))] ring-1 ring-[rgb(var(--accent))]' : 'border-[rgb(var(--border))]'} bg-[rgb(var(--surface))]`}>
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[rgb(var(--text))]">{t.label}</h3>
        {current && (
          <span className="rounded-full bg-[rgb(var(--accent)/0.12)] px-2 py-0.5 text-[10px] font-semibold text-[rgb(var(--accent))]">
            Current
          </span>
        )}
      </div>
      <div className="mb-4">
        <span className="text-2xl font-bold text-[rgb(var(--text))]">${t.priceAnnual}</span>
        <span className="text-xs text-[rgb(var(--text-3))]">/mo billed yearly</span>
        {t.priceMonthly > 0 && (
          <p className="text-[11px] text-[rgb(var(--text-3))]">or ${t.priceMonthly}/mo monthly</p>
        )}
      </div>
      <ul className="mb-5 flex-1 space-y-1.5">
        {featureRows(t).map((r) => (
          <li key={r.label} className="flex items-center justify-between text-xs">
            <span className="text-[rgb(var(--text-3))]">{r.label}</span>
            <span className="font-medium text-[rgb(var(--text-2))]">{r.value}</span>
          </li>
        ))}
      </ul>
      <Button variant={current ? 'hollow' : 'primary'} size="md" fullWidth disabled={current} onClick={onSelect}>
        {current ? 'Current plan' : t.priceAnnual === 0 ? 'Switch to Free' : 'Choose plan'}
      </Button>
    </div>
  )
}

export function PricingPage(): JSX.Element {
  const tier    = useTier()
  const setTier = useTierStore((s) => s.setTier)

  return (
    <main className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[rgb(var(--accent)/0.12)]">
            <Icon name="zap" size={20} className="text-[rgb(var(--accent))]" />
          </div>
          <h1 className="text-2xl font-bold text-[rgb(var(--text))]">Choose your plan</h1>
          <p className="mt-1 text-sm text-[rgb(var(--text-2))]">
            Upgrade for cloud sync, publishing, larger files, and longer version history.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {TIER_ORDER.map((t) => (
            <PlanCard key={t} tier={t} current={t === tier} onSelect={() => setTier(t)} />
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-[rgb(var(--text-3))]">
          Billing isn't connected yet — selecting a plan changes your local tier for testing.
        </p>
      </div>
    </main>
  )
}
