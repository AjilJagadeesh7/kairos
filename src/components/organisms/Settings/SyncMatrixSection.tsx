import { useEffect, useState } from 'react'

import { useAppStore } from '../../../store/useAppStore'
import { SectionLabel } from '../../atoms/SectionLabel'
import { SYNC_CATEGORIES, SYNC_PROVIDER_META } from '../../../types'
import type { SyncCategory, SyncProviderId } from '../../../types'

const CATEGORY_LABELS: Record<SyncCategory, string> = {
  notes:    'Notes',
  journal:  'Journal',
  kanban:   'Kanban',
  canvas:   'Canvas',
  settings: 'Settings',
  secrets:  'Secrets',
}

/**
 * Per-category × per-provider sync matrix. Each cell has two toggles:
 *   ↑ push (local → that provider)   ↓ pull (that provider → local)
 * letting the user route each feature to whichever providers they choose.
 * Only connected providers get a column.
 */
export function SyncMatrixSection() {
  const syncRules    = useAppStore((s) => s.syncRules)
  const setSyncRule  = useAppStore((s) => s.setSyncRule)
  const s3Config     = useAppStore((s) => s.s3Config)
  const webdavConfig = useAppStore((s) => s.webdavConfig)

  const [localConnected, setLocalConnected] = useState(false)
  useEffect(() => {
    void import('../../../sync/localFolder').then(({ isLocalFolderConnected }) => setLocalConnected(isLocalFolderConnected()))
  }, [])

  const providers: SyncProviderId[] = [
    ...(localConnected ? (['local'] as const) : []),
    ...(s3Config       ? (['s3'] as const)    : []),
    ...(webdavConfig   ? (['webdav'] as const): []),
  ]
  if (providers.length === 0) return null

  return (
    <div>
      <SectionLabel className="mb-1">What syncs where</SectionLabel>
      <p className="mb-3 text-xs text-[rgb(var(--text-3))]">
        Route each type to specific providers. <strong>↑</strong> push (local → provider),{' '}
        <strong>↓</strong> pull (provider → local).
      </p>

      <div className="overflow-x-auto rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[rgb(var(--border))] text-[10px] uppercase tracking-widest text-[rgb(var(--text-3))]">
              <th className="px-3 py-2 text-left font-medium">Type</th>
              {providers.map((p) => (
                <th key={p} className="px-3 py-2 text-center font-medium">{SYNC_PROVIDER_META[p].short}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SYNC_CATEGORIES.map((cat) => (
              <tr key={cat} className="border-b border-border/40 last:border-0">
                <td className="whitespace-nowrap px-3 py-2.5 text-[rgb(var(--text))]">{CATEGORY_LABELS[cat]}</td>
                {providers.map((p) => (
                  <td key={p} className="px-3 py-2.5">
                    <div className="flex items-center justify-center gap-1.5">
                      <DirChip
                        arrow="↑" label={`Push ${cat} to ${SYNC_PROVIDER_META[p].label}`}
                        on={syncRules[cat][p].push}
                        onClick={() => setSyncRule(cat, p, 'push', !syncRules[cat][p].push)}
                      />
                      <DirChip
                        arrow="↓" label={`Pull ${cat} from ${SYNC_PROVIDER_META[p].label}`}
                        on={syncRules[cat][p].pull}
                        onClick={() => setSyncRule(cat, p, 'pull', !syncRules[cat][p].pull)}
                      />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-[rgb(var(--text-3))]">
        Secrets (provider credentials) stay on this device unless you enable them here.
      </p>
    </div>
  )
}

function DirChip({ arrow, label, on, onClick }: { arrow: string; label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={on}
      className={`flex h-6 w-6 items-center justify-center rounded-md border text-xs font-semibold transition ${
        on
          ? 'border-accent bg-accent/15 text-accent'
          : 'border-border text-text3 hover:text-text'
      }`}
    >
      {arrow}
    </button>
  )
}
