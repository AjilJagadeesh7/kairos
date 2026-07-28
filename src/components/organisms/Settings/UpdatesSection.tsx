import { useEffect } from 'react'
import { useAppUpdater } from '../../../hooks/useAppUpdater'
import { useMobileUpdater } from '../../../hooks/useMobileUpdater'
import { isDesktop, isMobile } from '../../../utils/platform'
import { SectionCard } from '../../molecules/SectionCard'
import { ChangelogAccordion } from './ChangelogAccordion'
import { SectionLabel } from '../../atoms/SectionLabel'
import { Button } from '../../atoms/Button'
import { Icon } from '../../../icons/Icon'

const VERSION = __APP_VERSION__

export function UpdatesSection() {
  // Desktop uses the Tauri updater; mobile uses the Capgo OTA updater. Both
  // hooks are called unconditionally (React rules); we drive the one matching
  // the platform. They return the same shape.
  const desktopUpdater = useAppUpdater()
  const mobileUpdater  = useMobileUpdater()
  const onMobile       = isMobile()
  const hasUpdater     = isDesktop() || onMobile
  const { status, info, progressPct, error, checkForUpdate, downloadAndInstall, restart } =
    onMobile ? mobileUpdater : desktopUpdater

  useEffect(() => {
    if (hasUpdater) void checkForUpdate()
  }, [hasUpdater, checkForUpdate])

  return (
    <div className="space-y-4">
      <SectionCard title="App Updates">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-text2">
              Current version: <span className="font-mono font-medium text-text">v{VERSION}</span>
            </p>
            {onMobile && (
              <p className="mt-1 text-xs text-text3">
                Updates download over the air — no app store reinstall needed.
              </p>
            )}
            {!hasUpdater && (
              <p className="mt-1 text-xs text-text3">
                Auto-updates are available in the desktop and mobile apps.
              </p>
            )}
          </div>

          {hasUpdater && (
            <div className="flex shrink-0 flex-col items-end gap-2">
              {status === 'idle' || status === 'up-to-date' ? (
                <div className="flex items-center gap-2">
                  {status === 'up-to-date' && (
                    <span className="flex items-center gap-1 text-xs text-green-500">
                      <Icon name="check-circle-2" size={13} /> Up to date
                    </span>
                  )}
                  <Button variant="ghost" size="md" onClick={() => void checkForUpdate()}>
                    Check for updates
                  </Button>
                </div>
              ) : status === 'checking' ? (
                <span className="flex items-center gap-1.5 text-xs text-text3">
                  <Icon name="loader-2" size={13} className="animate-spin" /> Checking…
                </span>
              ) : status === 'available' ? (
                <div className="flex flex-col items-end gap-1.5">
                  <span className="text-xs font-medium text-accent">
                    v{info?.version} available
                  </span>
                  <Button variant="primary" size="md" onClick={() => void downloadAndInstall()}>
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
                  <Button variant="primary" size="md" onClick={() => void restart()}>
                    {onMobile ? 'Reload & Update' : 'Restart & Update'}
                  </Button>
                </div>
              ) : status === 'needs-native' ? (
                <div className="flex max-w-[16rem] flex-col items-end gap-1.5 text-right">
                  <span className="flex items-center gap-1 text-xs text-amber-400">
                    <Icon name="alert-triangle" size={13} /> App update required
                  </span>
                  <span className="text-xs text-text3">
                    v{info?.version} needs a newer app build. Update Kairos from where you
                    installed it (store or APK).
                  </span>
                </div>
              ) : status === 'error' ? (
                <div className="flex flex-col items-end gap-1.5">
                  <span className="text-xs text-red-400">
                    {error ?? 'Update check failed'}
                  </span>
                  <Button variant="ghost" size="md" onClick={() => void checkForUpdate()}>
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

      <section>
        <SectionLabel className="mb-2 px-1">Changelog</SectionLabel>
        <ChangelogAccordion />
      </section>
    </div>
  )
}
