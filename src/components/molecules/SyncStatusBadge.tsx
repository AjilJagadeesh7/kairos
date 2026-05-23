import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAppStore } from '../../store/useAppStore'
import { useConflictStore } from '../../store/useConflictStore'
import { anySyncProviderConnected } from '../../sync/syncOrchestrator'
import { useClickOutside } from '../../hooks/useClickOutside'
import { Icon } from '../../icons/Icon'

const STATUS_LABEL: Record<string, string> = {
  idle:    'Sync is idle — auto-syncs on save and startup',
  syncing: 'Syncing…',
  ok:      'Last sync succeeded',
  error:   'Last sync failed — check your connection or credentials',
}

export function SyncStatusBadge(): JSX.Element {
  const syncStatus    = useAppStore(s => s.syncStatus)
  const conflictCount = useConflictStore(s => s.conflicts.length)
  const connected     = anySyncProviderConnected()
  const s3Config      = useAppStore(s => s.s3Config)
  const webdavConfig  = useAppStore(s => s.webdavConfig)
  const lastSyncTime  = useAppStore(s => s.lastSyncTime)
  const navigate      = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false))

  const isS3Configured = !!(s3Config && s3Config.bucket && s3Config.endpoint)
  const isWebDAVConfigured = !!(webdavConfig && webdavConfig.url)

  const dotColor =
    conflictCount > 0      ? 'bg-amber-400'               :
    syncStatus === 'ok'    ? 'bg-green-500'                :
    syncStatus === 'syncing' ? 'bg-yellow-400 animate-pulse' :
    syncStatus === 'error' ? 'bg-red-400'                  :
    'bg-[rgb(var(--surface-3))]'

  const formatLastSync = (timeStr: string | null) => {
    if (!timeStr) return 'Never'
    try {
      const dt = new Date(timeStr)
      return dt.toLocaleString()
    } catch {
      return 'Never'
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label={`Sync status: ${syncStatus}${conflictCount > 0 ? `, ${conflictCount} conflict${conflictCount > 1 ? 's' : ''}` : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
        className="flex h-11 w-12 items-center justify-center gap-1 text-[rgb(var(--text-3))] transition hover:text-[rgb(var(--text))]"
      >
        {connected
          ? syncStatus === 'syncing'
            ? <Icon name="loader-2" size={13} className="animate-spin" aria-hidden />
            : <Icon name="cloud" size={13} aria-hidden />
          : <Icon name="cloud-off" size={13} aria-hidden />
        }
        <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} aria-hidden />
        {conflictCount > 0 && (
          <span className="rounded-full bg-amber-400/20 px-1 text-[10px] font-semibold text-amber-600">
            {conflictCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Sync status details"
          className="absolute right-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] shadow-2xl animate-in fade-in slide-in-from-top-1 duration-100"
        >
          {/* Status row */}
          <div className="flex items-start gap-2.5 px-4 py-3">
            <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${dotColor}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold capitalize text-[rgb(var(--text))]">
                {connected ? `Sync ${syncStatus}` : 'Sync disabled'}
              </p>
              <p className="mt-0.5 text-[11px] text-[rgb(var(--text-3))] leading-snug">
                {connected ? STATUS_LABEL[syncStatus] : 'No sync provider connected'}
              </p>
              {connected && (
                <p className="mt-2 text-[10px] text-[rgb(var(--text-2))]">
                  Last Synced: <span className="font-medium text-[rgb(var(--text))]">{formatLastSync(lastSyncTime)}</span>
                </p>
              )}
            </div>
          </div>

          {/* Active Providers Row */}
          <div className="border-t border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-4 py-2.5 space-y-1.5">
            <p className="text-[9px] font-bold uppercase tracking-wider text-[rgb(var(--text-3))]">Sync Providers</p>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[rgb(var(--text-2))]">S3 Storage</span>
              <span className={`font-semibold ${isS3Configured ? 'text-green-500 dark:text-green-400' : 'text-[rgb(var(--text-3))]'}`}>
                {isS3Configured ? 'Configured' : 'Disabled'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[rgb(var(--text-2))]">WebDAV NAS</span>
              <span className={`font-semibold ${isWebDAVConfigured ? 'text-green-500 dark:text-green-400' : 'text-[rgb(var(--text-3))]'}`}>
                {isWebDAVConfigured ? 'Configured' : 'Disabled'}
              </span>
            </div>
          </div>

          {/* Conflicts section */}
          {conflictCount > 0 && (
            <div className="border-t border-[rgb(var(--border))] bg-amber-50/60 px-4 py-2.5 dark:bg-amber-950/20">
              <div className="flex items-center gap-1.5">
                <Icon name="alert-triangle" size={12} className="text-amber-500" aria-hidden />
                <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                  {conflictCount} conflict{conflictCount > 1 ? 's' : ''} to resolve
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-amber-600/80 dark:text-amber-500/80 leading-snug">
                Open the affected notes to review and merge.
              </p>
            </div>
          )}

          {/* Footer actions */}
          <div className="flex items-center gap-2 border-t border-[rgb(var(--border))] px-4 py-2.5">
            <button
              type="button"
              onClick={() => { setOpen(false); navigate('/settings') }}
              className="flex-1 rounded-lg bg-[rgb(var(--accent))] px-3 py-1.5 text-center text-[11px] font-semibold text-[rgb(var(--accent-fg))] transition hover:opacity-90"
            >
              {connected ? 'Sync settings' : 'Configure sync'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="rounded p-1.5 text-[rgb(var(--text-3))] hover:text-[rgb(var(--text))]"
            >
              <Icon name="x" size={13} aria-hidden />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
