import { useEffect, useState } from 'react'
import { FolderOpen, RefreshCw, X } from 'lucide-react'
import { useAppStore } from '../../../store/useAppStore'
import { Button } from '../../atoms/Button'
import { SectionCard } from '../../molecules/SectionCard'
import { Field } from '../../molecules/Field'
import { StatusPill } from '../../molecules/StatusPill'
import {
  connectLocalFolder, disconnectLocalFolder,
  getLocalFolderName, initLocalFolder, isLocalFolderConnected,
} from '../../../sync/localFolder'
import {
  isS3Connected, setS3Config, testS3Connection,
} from '../../../sync/s3'
import {
  isWebDAVConnected, setWebDAVConfig, testWebDAVConnection,
} from '../../../sync/webdav'
import { syncAllProviders } from '../../../sync/syncOrchestrator'
import type { S3Config } from '../../../sync/s3'
import type { WebDAVConfig } from '../../../sync/webdav'

export function SyncSection() {
  const syncStatus    = useAppStore((s) => s.syncStatus)
  const setSyncStatus = useAppStore((s) => s.setSyncStatus)
  const storedS3      = useAppStore((s) => s.s3Config)
  const storedDAV     = useAppStore((s) => s.webdavConfig)
  const saveS3        = useAppStore((s) => s.setS3Config)
  const saveDAV       = useAppStore((s) => s.setWebDAVConfig)

  const [localConnected,  setLocalConnected]  = useState(false)
  const [localFolderName, setLocalFolderName] = useState<string | null>(null)

  const [s3Endpoint,  setS3Endpoint]  = useState(storedS3?.endpoint  ?? '')
  const [s3Bucket,    setS3Bucket]    = useState(storedS3?.bucket     ?? '')
  const [s3Region,    setS3Region]    = useState(storedS3?.region     ?? 'auto')
  const [s3AccessKey, setS3AccessKey] = useState(storedS3?.accessKey  ?? '')
  const [s3SecretKey, setS3SecretKey] = useState(storedS3?.secretKey  ?? '')
  const [s3Connected, setS3Connected] = useState(false)
  const [s3Error,     setS3Error]     = useState('')
  const [s3Saving,    setS3Saving]    = useState(false)

  const [davUrl,       setDavUrl]       = useState(storedDAV?.url      ?? '')
  const [davUser,      setDavUser]      = useState(storedDAV?.username  ?? '')
  const [davPass,      setDavPass]      = useState(storedDAV?.password  ?? '')
  const [davConnected, setDavConnected] = useState(false)
  const [davError,     setDavError]     = useState('')
  const [davSaving,    setDavSaving]    = useState(false)

  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    void initLocalFolder().then(() => {
      setLocalConnected(isLocalFolderConnected())
      setLocalFolderName(getLocalFolderName())
    })
    if (storedS3)  { setS3Config(storedS3);   setS3Connected(isS3Connected()) }
    if (storedDAV) { setWebDAVConfig(storedDAV); setDavConnected(isWebDAVConnected()) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onConnectLocal() {
    try {
      await connectLocalFolder()
      setLocalConnected(isLocalFolderConnected())
      setLocalFolderName(getLocalFolderName())
      // Flush all current settings into the newly connected folder
      const { saveCurrentSettings } = await import('../../../sync/settingsSync')
      void saveCurrentSettings()
    } catch { /* user cancelled */ }
  }

  async function onDisconnectLocal() {
    await disconnectLocalFolder()
    setLocalConnected(false)
    setLocalFolderName(null)
  }

  async function onSaveS3() {
    setS3Error(''); setS3Saving(true)
    const cfg: S3Config = {
      endpoint: s3Endpoint.trim(), bucket: s3Bucket.trim(),
      region: s3Region.trim() || 'auto',
      accessKey: s3AccessKey.trim(), secretKey: s3SecretKey,
    }
    try {
      await testS3Connection(cfg)
      setS3Config(cfg); saveS3(cfg); setS3Connected(true)
      const { saveCurrentSettings } = await import('../../../sync/settingsSync')
      void saveCurrentSettings()
    } catch (err) {
      setS3Error(err instanceof Error ? err.message : 'Connection failed')
    } finally { setS3Saving(false) }
  }

  async function onSaveWebDAV() {
    setDavError(''); setDavSaving(true)
    const cfg: WebDAVConfig = { url: davUrl.trim(), username: davUser.trim(), password: davPass }
    try {
      await testWebDAVConnection(cfg)
      setWebDAVConfig(cfg); saveDAV(cfg); setDavConnected(true)
      const { saveCurrentSettings } = await import('../../../sync/settingsSync')
      void saveCurrentSettings()
    } catch (err) {
      setDavError(err instanceof Error ? err.message : 'Connection failed')
    } finally { setDavSaving(false) }
  }

  async function onSyncNow() {
    setSyncing(true)
    await syncAllProviders(setSyncStatus)
    setSyncing(false)
  }

  const anyConnected = localConnected || s3Connected || davConnected

  return (
    <div className="space-y-4">
      {/* Local Folder */}
      <SectionCard title="Local Folder">
        <p className="mb-3 text-xs text-[rgb(var(--text-2))]">
          Sync notes as plain .md files to a folder on this device.
          Works with Dropbox, iCloud Drive, OneDrive, Proton Drive desktop app, etc.
        </p>
        <div className="flex items-center justify-between gap-3">
          <StatusPill connected={localConnected} label={localConnected ? (localFolderName ?? 'Connected') : 'Not connected'} />
          {localConnected ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs text-[rgb(var(--text-2))]">
                <FolderOpen size={12} className="text-green-500" /> {localFolderName}
              </span>
              <Button variant="ghost" size="xs" onClick={() => void onDisconnectLocal()}>
                <X size={11} className="mr-1" /> Disconnect
              </Button>
            </div>
          ) : (
            <Button variant="primary" size="sm" onClick={() => void onConnectLocal()}>Choose Folder…</Button>
          )}
        </div>
      </SectionCard>

      {/* S3 */}
      <SectionCard title="S3 / Cloudflare R2 / Backblaze B2">
        <p className="mb-3 text-xs text-[rgb(var(--text-2))]">
          Any S3-compatible object storage. Ensure CORS is configured if using from a web browser.
        </p>
        {s3Connected ? (
          <div className="flex items-center justify-between">
            <StatusPill connected label={storedS3?.bucket ?? 'Connected'} />
            <Button variant="ghost" size="xs" onClick={() => {
              setS3Config(null); saveS3(null); setS3Connected(false)
              void import('../../../sync/settingsSync').then(({ saveCurrentSettings }) => saveCurrentSettings())
            }}>
              <X size={11} className="mr-1" /> Disconnect
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Endpoint URL" placeholder="https://…" type="url" value={s3Endpoint} onChange={setS3Endpoint} />
              <Field label="Bucket" placeholder="my-vault" mono value={s3Bucket} onChange={setS3Bucket} />
              <Field label="Region" placeholder="auto" mono value={s3Region} onChange={setS3Region} />
              <Field label="Access Key ID" mono value={s3AccessKey} onChange={setS3AccessKey} />
            </div>
            <Field label="Secret Access Key" type="password" mono value={s3SecretKey} onChange={setS3SecretKey} />
            {s3Error && <p className="text-xs text-red-400">{s3Error}</p>}
            <Button variant="primary" size="sm" onClick={() => void onSaveS3()}
              disabled={s3Saving || !s3Endpoint || !s3Bucket || !s3AccessKey || !s3SecretKey}>
              {s3Saving ? 'Testing…' : 'Test & Connect'}
            </Button>
          </div>
        )}
      </SectionCard>

      {/* WebDAV */}
      <SectionCard title="WebDAV">
        <p className="mb-3 text-xs text-[rgb(var(--text-2))]">
          Nextcloud, ownCloud, Koofr, pCloud, Box, any NAS. Use an app password where supported.
        </p>
        {davConnected ? (
          <div className="flex items-center justify-between">
            <StatusPill connected label={storedDAV?.username ?? 'Connected'} />
            <Button variant="ghost" size="xs" onClick={() => {
              setWebDAVConfig(null); saveDAV(null); setDavConnected(false)
              void import('../../../sync/settingsSync').then(({ saveCurrentSettings }) => saveCurrentSettings())
            }}>
              <X size={11} className="mr-1" /> Disconnect
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Field label="WebDAV URL" placeholder="https://cloud.example.com/…" type="url" value={davUrl} onChange={setDavUrl} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Username" value={davUser} onChange={setDavUser} />
              <Field label="Password / App Password" type="password" value={davPass} onChange={setDavPass} />
            </div>
            {davError && <p className="text-xs text-red-400">{davError}</p>}
            <Button variant="primary" size="sm" onClick={() => void onSaveWebDAV()}
              disabled={davSaving || !davUrl || !davUser || !davPass}>
              {davSaving ? 'Connecting…' : 'Test & Connect'}
            </Button>
          </div>
        )}
      </SectionCard>

      {/* Sync now */}
      {anyConnected ? (
        <div className="flex items-center justify-between rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-4 py-3">
          <div>
            <p className="text-sm font-medium text-[rgb(var(--text))]">Sync All Notes Now</p>
            <p className="text-xs text-[rgb(var(--text-3))]">Push & pull plain .md files across all connected providers.</p>
          </div>
          <Button variant="primary" size="sm" onClick={() => void onSyncNow()} disabled={syncing}
            className="inline-flex items-center gap-1.5 shrink-0">
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing…' : 'Sync Now'}
          </Button>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-[rgb(var(--border))] p-4 text-center text-xs text-[rgb(var(--text-3))]">
          Connect at least one provider above to enable sync. Notes are always saved to IndexedDB locally.
        </p>
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
        {syncStatus === 'error'   && 'Last sync encountered an error — check console'}
      </div>
    </div>
  )
}
