import { useEffect } from 'react'
import { useAppUpdater } from '../../../hooks/useAppUpdater'
import { CHANGELOG } from '../../../data/changelog'
import { isDesktop } from '../../../utils/platform'
import { SectionCard } from '../../molecules/SectionCard'
import { Button } from '../../atoms/Button'
import { Icon } from '../../../icons/Icon'

const VERSION = __APP_VERSION__

export function UpdatesSection() {
  const { status, info, progressPct, error, checkForUpdate, downloadAndInstall, restart } = useAppUpdater()

  useEffect(() => {
    if (isDesktop()) void checkForUpdate()
  }, [checkForUpdate])

  return (
    <div className="space-y-4">
      <SectionCard title="App Updates">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-text2">
              Current version: <span className="font-mono font-medium text-text">v{VERSION}</span>
            </p>
            {!isDesktop() && (
              <p className="mt-1 text-xs text-text3">
                Auto-updates are available on the desktop app only.
              </p>
            )}
          </div>

          {isDesktop() && (
            <div className="flex shrink-0 flex-col items-end gap-2">
              {status === 'idle' || status === 'up-to-date' ? (
                <div className="flex items-center gap-2">
                  {status === 'up-to-date' && (
                    <span className="flex items-center gap-1 text-xs text-green-500">
                      <Icon name="check-circle-2" size={13} /> Up to date
                    </span>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => void checkForUpdate()}>
                    Check for updates
                  </Button>
                </div>
              ) : status === 'checking' ? (
                <span className="flex items-center gap-1.5 text-xs text-text3">
                  <Icon name="loader" size={13} className="animate-spin" /> Checking…
                </span>
              ) : status === 'available' ? (
                <div className="flex flex-col items-end gap-1.5">
                  <span className="text-xs font-medium text-accent">
                    v{info?.version} available
                  </span>
                  <Button variant="primary" size="sm" onClick={() => void downloadAndInstall()}>
                    Download &amp; Install
                  </Button>
                </div>
              ) : status === 'downloading' ? (
                <div className="flex flex-col items-end gap-1.5">
                  <span className="text-xs text-text3">Downloading… {progressPct}%</span>
                  <div className="h-1.5 w-32 overflow-hidden rounded-full bg-surface3">
                    <div
                      className="h-full rounded-full bg-accent transition-all duration-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              ) : status === 'ready' ? (
                <div className="flex flex-col items-end gap-1.5">
                  <span className="flex items-center gap-1 text-xs text-green-500">
                    <Icon name="check-circle-2" size={13} /> Ready to install
                  </span>
                  <Button variant="primary" size="sm" onClick={() => void restart()}>
                    Restart &amp; Update
                  </Button>
                </div>
              ) : status === 'error' ? (
                <div className="flex flex-col items-end gap-1.5">
                  <span className="text-xs text-red-400">
                    {error ?? 'Update check failed'}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => void checkForUpdate()}>
                    Retry
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {status === 'available' && info?.body && (
          <div className="mt-4 rounded-lg border border-accent/20 bg-accent/5 p-3">
            <p className="mb-1 text-xs font-semibold text-accent">What&apos;s new in v{info.version}</p>
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-text3">{info.body}</p>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Changelog">
        <div className="space-y-6">
          {CHANGELOG.map(entry => (
            <div key={entry.version}>
              <div className="mb-3 flex items-center gap-2">
                <span className="font-mono text-sm font-semibold text-text">v{entry.version}</span>
                <span className="text-xs text-text3">{entry.date}</span>
                {entry.version === VERSION && (
                  <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
                    current
                  </span>
                )}
              </div>

              {entry.highlights.map(h => (
                <p key={h} className="mb-2 text-sm text-text2">{h}</p>
              ))}

              {entry.added && entry.added.length > 0 && (
                <ChangeGroup label="Added" color="text-green-500" items={entry.added} />
              )}
              {entry.improved && entry.improved.length > 0 && (
                <ChangeGroup label="Improved" color="text-blue-400" items={entry.improved} />
              )}
              {entry.fixed && entry.fixed.length > 0 && (
                <ChangeGroup label="Fixed" color="text-amber-400" items={entry.fixed} />
              )}
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}

function ChangeGroup({ label, color, items }: { label: string; color: string; items: string[] }) {
  return (
    <div className="mb-3">
      <p className={`mb-1 text-[11px] font-semibold uppercase tracking-wider ${color}`}>{label}</p>
      <ul className="space-y-0.5">
        {items.map(item => (
          <li key={item} className="flex items-start gap-1.5 text-xs text-text2">
            <span className={`mt-1 shrink-0 ${color}`}>•</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
