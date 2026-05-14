import { useEffect, useState } from 'react'
import { FolderOpen, RefreshCw, X } from 'lucide-react'
import { Button } from '../ui/Button'
import { ThemeSelect } from '../ui/ThemeSelect'
import { useAppStore } from '../../store/useAppStore'
import type { StorageTarget } from '../../store/useAppStore'
import {
  connectLocalFolder, disconnectLocalFolder,
  getLocalFolderName, initLocalFolder, isLocalFolderConnected,
} from '../../sync/localFolder'
import {
  isS3Connected, setS3Config, testS3Connection,
} from '../../sync/s3'
import {
  isWebDAVConnected, setWebDAVConfig, testWebDAVConnection,
} from '../../sync/webdav'
import { syncAllProviders } from '../../sync/syncOrchestrator'
import type { S3Config } from '../../sync/s3'
import type { WebDAVConfig } from '../../sync/webdav'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Section = 'general' | 'sync' | 'storage' | 'about'

interface SettingsPanelProps {
  section: Section
}

// ---------------------------------------------------------------------------
// Reusable sub-components
// ---------------------------------------------------------------------------

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
      <div className="border-b border-[rgb(var(--border))] px-4 py-3">
        <h3 className="text-sm font-semibold text-[rgb(var(--text))]">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function Field({
  label, placeholder, value, onChange, type = 'text', mono = false,
}: {
  label: string; placeholder?: string; value: string
  onChange: (v: string) => void; type?: string; mono?: boolean
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-medium uppercase tracking-wider text-[rgb(var(--text-3))]">
        {label}
      </span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        className={`w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-3 py-2 text-sm text-[rgb(var(--text))] outline-none placeholder:text-[rgb(var(--text-3))] focus:border-[rgb(var(--text-2))] ${mono ? 'font-mono text-xs' : ''}`}
      />
    </label>
  )
}

function StatusPill({ connected, label }: { connected: boolean; label?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
      connected ? 'bg-green-500/15 text-green-500' : 'bg-[rgb(var(--surface-3))] text-[rgb(var(--text-3))]'
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-[rgb(var(--text-3))]'}`} />
      {label ?? (connected ? 'Connected' : 'Not connected')}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Section: General
// ---------------------------------------------------------------------------

function GeneralSection() {
  const theme    = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  const aiUrl    = useAppStore((s) => s.aiUrl)
  const setAiUrl = useAppStore((s) => s.setAiUrl)

  const [localAiUrl, setLocalAiUrl] = useState(aiUrl)

  async function handleThemeChange(t: Parameters<typeof setTheme>[0]) {
    setTheme(t)
    const { saveCurrentSettings } = await import('../../sync/settingsSync')
    void saveCurrentSettings()
  }

  async function saveAiUrl() {
    setAiUrl(localAiUrl)
    const { saveCurrentSettings } = await import('../../sync/settingsSync')
    void saveCurrentSettings()
  }

  return (
    <div className="space-y-4">
      <SectionCard title="Appearance">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-[rgb(var(--text))]">Theme</p>
            <p className="text-xs text-[rgb(var(--text-3))]">Choose your preferred colour scheme</p>
          </div>
          <ThemeSelect value={theme} onChange={(t) => void handleThemeChange(t)} />
        </div>
      </SectionCard>

      <SectionCard title="AI Server">
        <div className="space-y-3">
          <p className="text-xs text-[rgb(var(--text-2))]">
            URL of a local Ollama or compatible server used for embeddings and AI features.
          </p>
          <Field label="Server URL" placeholder="http://localhost:11434" type="url" value={localAiUrl} onChange={setLocalAiUrl} />
          <Button variant="primary" size="sm" onClick={() => void saveAiUrl()}>Save</Button>
        </div>
      </SectionCard>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section: Sync
// ---------------------------------------------------------------------------

function SyncSection() {
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
      const { saveCurrentSettings } = await import('../../sync/settingsSync')
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
      const { saveCurrentSettings } = await import('../../sync/settingsSync')
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
      const { saveCurrentSettings } = await import('../../sync/settingsSync')
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
              void import('../../sync/settingsSync').then(({ saveCurrentSettings }) => saveCurrentSettings())
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
              void import('../../sync/settingsSync').then(({ saveCurrentSettings }) => saveCurrentSettings())
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

// ---------------------------------------------------------------------------
// Section: Storage
// ---------------------------------------------------------------------------

type StorageId = StorageTarget

function StorageSection() {
  const storageChoices    = useAppStore((s) => s.storageChoices)
  const setStorageChoices = useAppStore((s) => s.setStorageChoices)

  const supportsFS = 'showDirectoryPicker' in window
    || !!((window as unknown as Record<string, unknown>).__TAURI_INTERNALS__)

  const [folderConnected, setFolderConnected] = useState(false)
  const [folderName,      setFolderName]      = useState<string | null>(null)

  useEffect(() => {
    void import('../../sync/plainFolder').then(({ isPlainFolderConnected, getPlainFolderName }) => {
      setFolderConnected(isPlainFolderConnected())
      setFolderName(getPlainFolderName())
    })
  }, [])

  function toggle(id: StorageId, alwaysOn?: boolean) {
    if (alwaysOn) return
    const next = storageChoices.includes(id)
      ? storageChoices.filter((o) => o !== id)
      : [...storageChoices, id]
    if (next.length === 0) return
    setStorageChoices(next)
    void import('../../sync/settingsSync').then(({ saveCurrentSettings }) => saveCurrentSettings())
  }

  async function onConnect() {
    const { connectPlainFolder, isPlainFolderConnected, getPlainFolderName } = await import('../../sync/plainFolder')
    try {
      await connectPlainFolder()
      setFolderConnected(isPlainFolderConnected())
      setFolderName(getPlainFolderName())
    } catch { /* user cancelled */ }
  }

  async function onDisconnect() {
    const { disconnectPlainFolder } = await import('../../sync/plainFolder')
    await disconnectPlainFolder()
    setFolderConnected(false)
    setFolderName(null)
  }

  const OPTIONS: Array<{ id: StorageId; label: string; description: string; alwaysOn?: boolean; requiresFS?: boolean }> = [
    {
      id: 'indexdb',
      label: 'In-app storage (IndexedDB)',
      description: 'Notes live in the browser database. Fast, works everywhere, always active as the local cache.',
      alwaysOn: true,
    },
    {
      id: 'local',
      label: 'Local folder (filesystem)',
      description: 'Also write readable .md files to a folder on disk on every save.',
      requiresFS: true,
    },
  ]

  const localChecked = storageChoices.includes('local')

  return (
    <div className="space-y-4">
      <SectionCard title="Storage">
        <p className="mb-4 text-xs text-[rgb(var(--text-2))]">
          Select where notes are saved. IndexedDB is always on as the local cache.
          Enable additional targets and every save will write to all of them.
        </p>
        <div className="space-y-2">
          {OPTIONS.map(({ id, label, description, alwaysOn, requiresFS }) => {
            const checked  = storageChoices.includes(id)
            const disabled = alwaysOn || (requiresFS && !supportsFS)
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggle(id, alwaysOn)}
                disabled={disabled}
                className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                  checked
                    ? 'border-[rgb(var(--accent)_/_0.4)] bg-[rgb(var(--accent)_/_0.08)]'
                    : 'border-[rgb(var(--border))] hover:bg-[rgb(var(--surface-2))]'
                } ${disabled ? 'cursor-default opacity-60' : ''}`}
              >
                <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                  checked
                    ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent))]'
                    : 'border-[rgb(var(--border))] bg-[rgb(var(--surface-3))]'
                }`}>
                  {checked && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="1,4 3.5,6.5 9,1" />
                    </svg>
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[rgb(var(--text))]">
                    {label}
                    {alwaysOn && (
                      <span className="ml-2 text-[10px] font-normal text-[rgb(var(--text-3))]">always on</span>
                    )}
                  </p>
                  <p className="text-xs text-[rgb(var(--text-3))]">{description}</p>
                  {requiresFS && !supportsFS && (
                    <p className="mt-1 text-xs text-amber-400">
                      Not available in this browser — use Chrome, Edge, or the desktop app.
                    </p>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Folder connection — shown when local is checked */}
        {localChecked && supportsFS && (
          <div className="mt-4 flex items-center justify-between rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-3 py-2.5">
            <div className="flex items-center gap-2 text-sm">
              <FolderOpen size={14} className={folderConnected ? 'text-green-500' : 'text-[rgb(var(--text-3))]'} />
              <span className="text-[rgb(var(--text-2))]">
                {folderConnected ? (folderName ?? 'Connected') : 'No folder selected'}
              </span>
            </div>
            {folderConnected ? (
              <Button variant="ghost" size="xs" onClick={() => void onDisconnect()}>
                <X size={11} className="mr-1" /> Disconnect
              </Button>
            ) : (
              <Button variant="primary" size="sm" onClick={() => void onConnect()}>
                Choose Folder…
              </Button>
            )}
          </div>
        )}
      </SectionCard>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section: About
// ---------------------------------------------------------------------------

function AboutSection() {
  return (
    <div className="space-y-4">
      <SectionCard title="About MindVault">
        <div className="space-y-3 text-sm text-[rgb(var(--text-2))]">
          <p>MindVault is a privacy-first note-taking app with semantic search, wikilinks, and end-to-end encryption.</p>
          <p>Notes are stored locally first. Sync is optional and always encrypted before leaving your device.</p>
          <div className="rounded-lg bg-[rgb(var(--surface-2))] px-3 py-2 font-mono text-xs text-[rgb(var(--text-3))]">
            v0.0.0 · MIT License
          </div>
        </div>
      </SectionCard>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export function SettingsPanel({ section }: SettingsPanelProps) {
  return (
    <div className="p-6">
      <div className="mx-auto max-w-2xl space-y-4">
        {section === 'general' && <GeneralSection />}
        {section === 'sync'    && <SyncSection />}
        {section === 'storage' && <StorageSection />}
        {section === 'about'   && <AboutSection />}
      </div>
    </div>
  )
}
