import { useEffect, useState } from 'react'
import { CheckCircle2, Circle, FolderOpen, RefreshCw, X } from 'lucide-react'
import { useAppStore } from '../../../store/useAppStore'
import { Button } from '../../atoms/Button'
import { SectionCard } from '../../molecules/SectionCard'
import { Field } from '../../molecules/Field'
import { StatusPill } from '../../molecules/StatusPill'
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

  // Primary vault folder state
  const [vaultConnected, setVaultConnected] = useState(false)
  const [vaultName,      setVaultName]      = useState<string | null>(null)

  // S3 state
  const [s3Endpoint,  setS3Endpoint]  = useState(storedS3?.endpoint  ?? '')
  const [s3Bucket,    setS3Bucket]    = useState(storedS3?.bucket     ?? '')
  const [s3Region,    setS3Region]    = useState(storedS3?.region     ?? 'auto')
  const [s3AccessKey, setS3AccessKey] = useState(storedS3?.accessKey  ?? '')
  const [s3SecretKey, setS3SecretKey] = useState(storedS3?.secretKey  ?? '')
  const [s3Connected, setS3Connected] = useState(false)
  const [s3Error,     setS3Error]     = useState('')
  const [s3Saving,    setS3Saving]    = useState(false)

  // WebDAV state
  const [davUrl,       setDavUrl]       = useState(storedDAV?.url      ?? '')
  const [davUser,      setDavUser]      = useState(storedDAV?.username  ?? '')
  const [davPass,      setDavPass]      = useState(storedDAV?.password  ?? '')
  const [davConnected, setDavConnected] = useState(false)
  const [davError,     setDavError]     = useState('')
  const [davSaving,    setDavSaving]    = useState(false)

  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    void import('../../../sync/plainFolder').then(({ isPlainFolderConnected, getPlainFolderName }) => {
      setVaultConnected(isPlainFolderConnected())
      setVaultName(getPlainFolderName())
    })
    if (storedS3)  { setS3Config(storedS3);    setS3Connected(isS3Connected()) }
    if (storedDAV) { setWebDAVConfig(storedDAV); setDavConnected(isWebDAVConnected()) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onConnectVault() {
    const { connectPlainFolder, isPlainFolderConnected, getPlainFolderName } = await import('../../../sync/plainFolder')
    try {
      await connectPlainFolder()
      setVaultConnected(isPlainFolderConnected())
      setVaultName(getPlainFolderName())
      // Load notes and boards from newly selected folder
      const store = useAppStore.getState()
      await store.loadNotes()
      const { useKanbanStore } = await import('../../../store/useKanbanStore')
      await useKanbanStore.getState().loadBoards()
      const { saveCurrentSettings } = await import('../../../sync/settingsSync')
      void saveCurrentSettings()
    } catch { /* user cancelled */ }
  }

  async function onDisconnectVault() {
    const { disconnectPlainFolder } = await import('../../../sync/plainFolder')
    await disconnectPlainFolder()
    setVaultConnected(false)
    setVaultName(null)
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

  async function onDisconnectS3() {
    setS3Config(null); saveS3(null); setS3Connected(false)
    setS3Endpoint(''); setS3Bucket(''); setS3Region('auto')
    setS3AccessKey(''); setS3SecretKey('')
    const { saveCurrentSettings } = await import('../../../sync/settingsSync')
    void saveCurrentSettings()
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

  async function onDisconnectWebDAV() {
    setWebDAVConfig(null); saveDAV(null); setDavConnected(false)
    setDavUrl(''); setDavUser(''); setDavPass('')
    const { saveCurrentSettings } = await import('../../../sync/settingsSync')
    void saveCurrentSettings()
  }

  async function onSyncNow() {
    setSyncing(true)
    await syncAllProviders(setSyncStatus)
    // Reload after sync in case remote had new notes
    const { isPlainFolderConnected } = await import('../../../sync/plainFolder')
    if (isPlainFolderConnected()) await useAppStore.getState().loadNotes()
    setSyncing(false)
  }

  const anyRemoteConnected = s3Connected || davConnected

  return (
    <div className="space-y-6">

      {/* ── Vault folder (primary storage) ─────────────────────────────── */}
      <SectionCard title="Vault Folder">
        <p className="mb-4 text-xs text-[rgb(var(--text-2))]">
          Your single source of truth. All notes, boards, and config are stored inside this folder
          as plain files — easy to back up, version-control, or move to another device.
          The folder will contain <code className="rounded bg-[rgb(var(--surface-2))] px-1">notes/</code>,{' '}
          <code className="rounded bg-[rgb(var(--surface-2))] px-1">kanban/</code>, and{' '}
          <code className="rounded bg-[rgb(var(--surface-2))] px-1">config/</code> subdirectories.
        </p>

        {vaultConnected ? (
          <div className="flex items-center justify-between rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-3 py-2.5">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="shrink-0 text-green-500" />
              <div>
                <p className="text-sm font-medium text-[rgb(var(--text))]">{vaultName ?? 'Connected'}</p>
                <p className="text-[10px] text-[rgb(var(--text-3))]">notes/ · kanban/ · config/</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="xs" onClick={() => void onConnectVault()}>
                <FolderOpen size={12} className="mr-1" /> Change…
              </Button>
              <Button variant="ghost" size="xs" onClick={() => void onDisconnectVault()}>
                <X size={11} className="mr-1" /> Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-[rgb(var(--border))] p-8 text-center">
            <Circle size={24} className="text-[rgb(var(--text-3))]" />
            <div>
              <p className="text-sm font-medium text-[rgb(var(--text))]">No vault folder selected</p>
              <p className="mt-0.5 text-xs text-[rgb(var(--text-3))]">
                Pick a folder on your device. Subdirectories will be created automatically.
              </p>
            </div>
            <Button variant="primary" size="sm" onClick={() => void onConnectVault()}>
              <FolderOpen size={13} className="mr-1.5" /> Choose Folder…
            </Button>
          </div>
        )}
      </SectionCard>

      {/* ── Remote sync ────────────────────────────────────────────────── */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[rgb(var(--text-3))]">
          Remote Sync (optional)
        </p>
        <p className="mb-4 text-xs text-[rgb(var(--text-2))]">
          Connect one or more remote providers to sync your vault across devices.
          Notes are pushed after every save and pulled on startup.
        </p>
      </div>

      {/* S3 */}
      <SectionCard title="S3 / Cloudflare R2 / Backblaze B2">
        <p className="mb-3 text-xs text-[rgb(var(--text-2))]">
          Any S3-compatible object storage. Ensure CORS is configured when using from a web browser.
        </p>
        {s3Connected ? (
          <div className="flex items-center justify-between">
            <StatusPill connected label={storedS3?.bucket ?? 'Connected'} />
            <Button variant="ghost" size="xs" onClick={() => void onDisconnectS3()}>
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
            <Button variant="ghost" size="xs" onClick={() => void onDisconnectWebDAV()}>
              <X size={11} className="mr-1" /> Disconnect
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Field label="WebDAV URL" placeholder="https://cloud.example.com/remote.php/dav/files/user" type="url" value={davUrl} onChange={setDavUrl} />
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
      {anyRemoteConnected && (
        <div className="flex items-center justify-between rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-4 py-3">
          <div>
            <p className="text-sm font-medium text-[rgb(var(--text))]">Sync Now</p>
            <p className="text-xs text-[rgb(var(--text-3))]">Push & pull notes across all connected remote providers.</p>
          </div>
          <Button variant="primary" size="sm" onClick={() => void onSyncNow()} disabled={syncing}
            className="inline-flex items-center gap-1.5 shrink-0">
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing…' : 'Sync Now'}
          </Button>
        </div>
      )}

      {/* Sync status indicator */}
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
