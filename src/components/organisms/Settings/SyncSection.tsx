import { useState } from 'react'

import { useAppStore } from '../../../store/useAppStore'
import { Button } from '../../atoms/Button'
import { syncAllProviders } from '../../../sync/syncOrchestrator'
import { VaultSection } from './VaultSection'
import { S3Section } from './S3Section'
import { WebDAVSection } from './WebDAVSection'
import { SyncMatrixSection } from './SyncMatrixSection'
import { Icon } from '../../../icons/Icon'
import { SectionLabel } from '../../atoms/SectionLabel'

export function SyncSection() {
  const syncStatus    = useAppStore((s) => s.syncStatus)
  const setSyncStatus = useAppStore((s) => s.setSyncStatus)
  const storedS3      = useAppStore((s) => s.s3Config)
  const storedDAV     = useAppStore((s) => s.webdavConfig)

  const [s3Connected,  setS3Connected]  = useState(!!storedS3)
  const [davConnected, setDavConnected] = useState(!!storedDAV)
  const [syncing,      setSyncing]      = useState(false)

  const anyRemoteConnected = s3Connected || davConnected

  async function onSyncNow() {
    setSyncing(true)
    await syncAllProviders(setSyncStatus)
    const { isPlainFolderConnected } = await import('../../../sync/plainFolder')
    if (isPlainFolderConnected()) await useAppStore.getState().loadNotes()
    setSyncing(false)
  }

  return (
    <div className="space-y-6">
      <VaultSection />

      <div>
        <SectionLabel className="mb-3">Remote Sync (optional)</SectionLabel>
        <p className="mb-4 text-xs text-[rgb(var(--text-2))]">
          Connect one or more remote providers to sync your vault across devices.
          Choose exactly what syncs below — notes, journal, kanban, canvas, settings, and secrets.
        </p>
      </div>

      <S3Section onConnectionChange={setS3Connected} />
      <WebDAVSection onConnectionChange={setDavConnected} />

      {anyRemoteConnected && <SyncMatrixSection />}

      {anyRemoteConnected && (
        <div className="flex items-center justify-between rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-4 py-3">
          <div>
            <p className="text-sm font-medium text-[rgb(var(--text))]">Sync Now</p>
            <p className="text-xs text-[rgb(var(--text-3))]">Push & pull all enabled types across every connected remote.</p>
          </div>
          <Button variant="primary" size="md" onClick={() => void onSyncNow()} disabled={syncing}
            className="inline-flex items-center gap-1.5 shrink-0">
            <Icon name="refresh-cw" size={13} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing…' : 'Sync Now'}
          </Button>
        </div>
      )}

      <div className={`flex items-center gap-2 text-xs ${
        syncStatus === 'ok'      ? 'text-green-500'  :
        syncStatus === 'error'   ? 'text-red-400'    :
        syncStatus === 'syncing' ? 'text-yellow-400' : 'text-[rgb(var(--text-3))]'
      }`}>
        <span className={`h-1.5 w-1.5 rounded-full ${
          syncStatus === 'ok'      ? 'bg-green-500'  :
          syncStatus === 'error'   ? 'bg-red-400'    :
          syncStatus === 'syncing' ? 'bg-yellow-400 animate-pulse' : 'bg-[rgb(var(--surface-3))]'
        }`} />
        {syncStatus === 'idle'    && 'Syncs automatically on startup and after every save'}
        {syncStatus === 'syncing' && 'Syncing…'}
        {syncStatus === 'ok'      && 'Last sync succeeded'}
        {syncStatus === 'error'   && 'Last sync encountered an error'}
      </div>
    </div>
  )
}
