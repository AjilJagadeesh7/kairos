import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Cloud, CloudOff, FolderOpen, RefreshCw } from 'lucide-react'
import { db } from '../../db/schema'
import { decryptText, deriveKey, encryptText } from '../../crypto/crypto'
import { Button } from '../ui/Button'
import { toRemotePayload } from '../../sync/drive'
import {
  connectLocalFolder,
  disconnectLocalFolder,
  getLocalFolderName,
  initLocalFolder,
  isLocalFolderConnected,
  listLocalNotes,
  upsertLocalNote,
} from '../../sync/localFolder'
import {
  isS3Connected,
  listS3Notes,
  setS3Config,
  testS3Connection,
  upsertS3Note,
} from '../../sync/s3'
import {
  isWebDAVConnected,
  listWebDAVNotes,
  setWebDAVConfig,
  testWebDAVConnection,
  upsertWebDAVNote,
} from '../../sync/webdav'
import { useAppStore } from '../../store/useAppStore'
import { parseTags } from '../../utils/wikilinks'
import type { Note } from '../../types'
import type { RemoteEncryptedNote } from '../../sync/types'
import type { SyncProviderType, SyncStatus } from '../../types'
import type { S3Config } from '../../sync/s3'
import type { WebDAVConfig } from '../../sync/webdav'

// protonDrive / googleDrive kept in union for backward-compat with persisted state
const ACTIVE_PROVIDERS: SyncProviderType[] = ['none', 'localFolder', 's3', 'webdav']

const PROVIDER_TAB_LABELS: Partial<Record<SyncProviderType, string>> = {
  none:        'None',
  localFolder: 'Local',
  s3:          'S3 / R2',
  webdav:      'WebDAV',
}

const PROVIDER_DISPLAY: Partial<Record<SyncProviderType, string>> = {
  none:        'None',
  localFolder: 'Local Folder',
  s3:          'S3 / R2',
  webdav:      'WebDAV',
}

// ---------------------------------------------------------------------------
// Shared sync algorithm — works with any provider
// ---------------------------------------------------------------------------
async function runSync(
  notes: Note[],
  listRemote:   () => Promise<RemoteEncryptedNote[]>,
  upsertRemote: (note: RemoteEncryptedNote, existingId?: string) => Promise<string>,
  key: CryptoKey,
  setSyncStatus: (s: SyncStatus) => void,
): Promise<void> {
  setSyncStatus('syncing')
  try {
    const remoteNotes   = await listRemote()
    const remoteById    = new Map(remoteNotes.map((r) => [r.noteId, r]))
    const localById     = new Map(notes.map((n) => [n.id, n]))

    for (const note of notes) {
      const remote        = remoteById.get(note.id)
      const localUpdated  = new Date(note.updatedAt).getTime()
      const remoteUpdated = remote ? new Date(remote.updatedAt).getTime() : -1
      if (!remote || localUpdated >= remoteUpdated) {
        const encrypted = await encryptText(note.content, key, note.updatedAt)
        const payload   = toRemotePayload(note, encrypted)
        const remoteId  = await upsertRemote(payload, remote?.fileId)
        await db.syncMeta.put({ noteId: note.id, lastSynced: new Date().toISOString(), remoteId })
      }
    }

    for (const remote of remoteNotes) {
      const local         = localById.get(remote.noteId)
      const localUpdated  = local ? new Date(local.updatedAt).getTime() : -1
      const remoteUpdated = new Date(remote.updatedAt).getTime()
      if (!local || remoteUpdated > localUpdated) {
        const content  = await decryptText(remote.encrypted, key)
        const hydrated: Note = {
          id:        remote.noteId,
          title:     remote.title || 'Untitled note',
          content,
          tags:      remote.tags.length > 0 ? remote.tags : parseTags(content),
          createdAt: remote.createdAt || remote.updatedAt,
          updatedAt: remote.updatedAt,
          embedding: local?.embedding ?? [],
        }
        await db.notes.put(hydrated)
        await db.syncMeta.put({ noteId: hydrated.id, lastSynced: new Date().toISOString(), remoteId: remote.fileId })
      }
    }

    setSyncStatus('ok')
  } catch (err) {
    console.error('Sync failed:', err)
    setSyncStatus('error')
  }
}

// ---------------------------------------------------------------------------
// Small reusable input
// ---------------------------------------------------------------------------
function Field({
  label, placeholder, value, onChange, type = 'text', mono = false,
}: {
  label: string
  placeholder?: string
  value: string
  onChange: (v: string) => void
  type?: 'text' | 'password' | 'url'
  mono?: boolean
}) {
  return (
    <label className="block space-y-0.5">
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
        className={`w-full rounded border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-2 py-1 text-xs text-[rgb(var(--text))] outline-none placeholder:text-[rgb(var(--text-3))] focus:border-[rgb(var(--text-2))] ${mono ? 'font-mono' : ''}`}
      />
    </label>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function SyncControls(): JSX.Element {
  const notes              = useLiveQuery(() => db.notes.toArray(), [], [])
  const syncStatus         = useAppStore((s) => s.syncStatus)
  const setSyncStatus      = useAppStore((s) => s.setSyncStatus)
  const syncProvider       = useAppStore((s) => s.syncProvider)
  const setSyncProvider    = useAppStore((s) => s.setSyncProvider)
  const storedS3Config     = useAppStore((s) => s.s3Config)
  const storedWebDAVConfig = useAppStore((s) => s.webdavConfig)
  const saveS3Config       = useAppStore((s) => s.setS3Config)
  const saveWebDAVConfig   = useAppStore((s) => s.setWebDAVConfig)

  const [open, setOpen] = useState(false)

  // Provider connection states
  const [localConnected,  setLocalConnected]  = useState(isLocalFolderConnected)
  const [localFolderName, setLocalFolderName] = useState<string | null>(getLocalFolderName)
  const [s3Connected,     setS3Connected]     = useState(false)
  const [webdavConnected, setWebDAVConnected] = useState(false)

  // S3 form state
  const [s3Endpoint,  setS3Endpoint]  = useState('')
  const [s3Bucket,    setS3Bucket]    = useState('')
  const [s3Region,    setS3Region]    = useState('auto')
  const [s3AccessKey, setS3AccessKey] = useState('')
  const [s3SecretKey, setS3SecretKey] = useState('')
  const [s3Error,     setS3Error]     = useState('')
  const [s3Testing,   setS3Testing]   = useState(false)

  // WebDAV form state
  const [davUrl,      setDavUrl]      = useState('')
  const [davUsername, setDavUsername] = useState('')
  const [davPassword, setDavPassword] = useState('')
  const [davError,    setDavError]    = useState('')
  const [davTesting,  setDavTesting]  = useState(false)

  const keyRef   = useRef<CryptoKey | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Migrate legacy protonDrive / googleDrive provider to none
  useEffect(() => {
    if (!ACTIVE_PROVIDERS.includes(syncProvider)) setSyncProvider('none')
  }, [syncProvider, setSyncProvider])

  // Restore persisted configs into sync module singletons on mount
  useEffect(() => {
    void initLocalFolder().then(() => {
      setLocalConnected(isLocalFolderConnected())
      setLocalFolderName(getLocalFolderName())
    })

    if (storedS3Config) {
      setS3Config(storedS3Config)
      setS3Connected(isS3Connected())
      setS3Endpoint(storedS3Config.endpoint)
      setS3Bucket(storedS3Config.bucket)
      setS3Region(storedS3Config.region)
      setS3AccessKey(storedS3Config.accessKey)
      setS3SecretKey(storedS3Config.secretKey)
    }

    if (storedWebDAVConfig) {
      setWebDAVConfig(storedWebDAVConfig)
      setWebDAVConnected(isWebDAVConnected())
      setDavUrl(storedWebDAVConfig.url)
      setDavUsername(storedWebDAVConfig.username)
      setDavPassword(storedWebDAVConfig.password)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Close panel on outside click
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // Auto-sync every 5 min when connected
  useEffect(() => {
    const connected =
      (syncProvider === 'localFolder' && localConnected)  ||
      (syncProvider === 's3'          && s3Connected)     ||
      (syncProvider === 'webdav'      && webdavConnected)
    if (!connected) return
    const timer = window.setInterval(() => { void handleSync() }, 5 * 60 * 1000)
    return () => window.clearInterval(timer)
  })

  // ---------------------------------------------------------------------------
  // Auth helpers
  // ---------------------------------------------------------------------------
  async function ensureCryptoKey(): Promise<CryptoKey | null> {
    if (keyRef.current) return keyRef.current
    const password = window.prompt('Enter your sync encryption password')
    if (!password) return null
    const key = await deriveKey(password)
    keyRef.current = key
    return key
  }

  // ---------------------------------------------------------------------------
  // Connect / disconnect handlers
  // ---------------------------------------------------------------------------
  async function onConnectLocal() {
    try {
      await connectLocalFolder()
      setLocalConnected(true)
      setLocalFolderName(getLocalFolderName())
      setSyncProvider('localFolder')
    } catch { /* user cancelled */ }
  }

  async function onDisconnectLocal() {
    await disconnectLocalFolder()
    setLocalConnected(false)
    setLocalFolderName(null)
    if (syncProvider === 'localFolder') setSyncProvider('none')
  }

  async function onSaveS3() {
    setS3Error('')
    setS3Testing(true)
    const cfg: S3Config = {
      endpoint:  s3Endpoint.trim(),
      bucket:    s3Bucket.trim(),
      region:    s3Region.trim() || 'auto',
      accessKey: s3AccessKey.trim(),
      secretKey: s3SecretKey,
    }
    try {
      await testS3Connection(cfg)
      setS3Config(cfg)
      saveS3Config(cfg)
      setS3Connected(true)
      setSyncProvider('s3')
    } catch (err) {
      setS3Error(err instanceof Error ? err.message : 'Connection failed')
    } finally {
      setS3Testing(false)
    }
  }

  function onDisconnectS3() {
    setS3Config(null)
    saveS3Config(null)
    setS3Connected(false)
    if (syncProvider === 's3') setSyncProvider('none')
  }

  async function onSaveWebDAV() {
    setDavError('')
    setDavTesting(true)
    const cfg: WebDAVConfig = {
      url:      davUrl.trim(),
      username: davUsername.trim(),
      password: davPassword,
    }
    try {
      await testWebDAVConnection(cfg)
      setWebDAVConfig(cfg)
      saveWebDAVConfig(cfg)
      setWebDAVConnected(true)
      setSyncProvider('webdav')
    } catch (err) {
      setDavError(err instanceof Error ? err.message : 'Connection failed')
    } finally {
      setDavTesting(false)
    }
  }

  function onDisconnectWebDAV() {
    setWebDAVConfig(null)
    saveWebDAVConfig(null)
    setWebDAVConnected(false)
    if (syncProvider === 'webdav') setSyncProvider('none')
  }

  // ---------------------------------------------------------------------------
  // Sync
  // ---------------------------------------------------------------------------
  async function handleSync() {
    const key = await ensureCryptoKey()
    if (!key) return
    if (syncProvider === 'localFolder' && localConnected)
      await runSync(notes, listLocalNotes, upsertLocalNote, key, setSyncStatus)
    else if (syncProvider === 's3' && s3Connected)
      await runSync(notes, listS3Notes, upsertS3Note, key, setSyncStatus)
    else if (syncProvider === 'webdav' && webdavConnected)
      await runSync(notes, listWebDAVNotes, upsertWebDAVNote, key, setSyncStatus)
  }

  // ---------------------------------------------------------------------------
  // Derived UI state
  // ---------------------------------------------------------------------------
  const isConnected =
    (syncProvider === 'localFolder' && localConnected)  ||
    (syncProvider === 's3'          && s3Connected)     ||
    (syncProvider === 'webdav'      && webdavConnected)

  const statusColor =
    syncStatus === 'ok'      ? 'bg-green-500'  :
    syncStatus === 'syncing' ? 'bg-yellow-400' :
    syncStatus === 'error'   ? 'bg-red-500'    : 'bg-[rgb(var(--surface-3))]'

  const displayLabel = PROVIDER_DISPLAY[syncProvider] ?? 'Sync'

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-[rgb(var(--text-2))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]"
        title={isConnected ? `Syncing via ${displayLabel}` : 'Sync settings'}
      >
        {isConnected ? <Cloud size={13} /> : <CloudOff size={13} />}
        <span className="hidden sm:inline">{isConnected ? displayLabel : 'Sync'}</span>
        <span className={`h-1.5 w-1.5 rounded-full ${statusColor}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4 shadow-xl" style={{ width: '22rem' }}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-3))]">
            Sync Provider
          </p>

          {/* Provider tabs */}
          <div className="mb-4 grid grid-cols-5 gap-0.5 rounded-md bg-[rgb(var(--surface-2))] p-0.5">
            {ACTIVE_PROVIDERS.map((p) => (
              <button
                key={p}
                onClick={() => setSyncProvider(p)}
                className={`rounded px-1 py-1 text-[11px] transition-colors ${
                  syncProvider === p
                    ? 'bg-[rgb(var(--surface))] font-medium text-[rgb(var(--text))] shadow-sm'
                    : 'text-[rgb(var(--text-3))] hover:text-[rgb(var(--text-2))]'
                }`}
              >
                {PROVIDER_TAB_LABELS[p]}
              </button>
            ))}
          </div>

          {/* None */}
          {syncProvider === 'none' && (
            <p className="text-xs text-[rgb(var(--text-3))]">
              No sync provider selected. Notes are stored locally only.
            </p>
          )}

          {/* Local Folder */}
          {syncProvider === 'localFolder' && (
            <div className="space-y-2">
              <p className="text-xs text-[rgb(var(--text-2))]">
                Saves encrypted note files to a folder on this device. Works with any cloud-synced
                folder — Dropbox, iCloud Drive, OneDrive, Proton Drive desktop app, etc.
              </p>
              {localConnected ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 truncate text-xs text-[rgb(var(--text))]">
                    <FolderOpen size={12} className="shrink-0 text-green-500" />
                    {localFolderName ?? 'Connected'}
                  </span>
                  <Button variant="ghost" size="xs" onClick={() => void onDisconnectLocal()}>
                    Disconnect
                  </Button>
                </div>
              ) : (
                <Button variant="primary" size="xs" onClick={() => void onConnectLocal()} className="w-full justify-center">
                  Choose Folder…
                </Button>
              )}
            </div>
          )}

          {/* S3 / R2 */}
          {syncProvider === 's3' && (
            <div className="space-y-2">
              <p className="text-xs text-[rgb(var(--text-2))]">
                Any S3-compatible bucket — Cloudflare R2, AWS S3, Backblaze B2, MinIO, Wasabi.
                Notes are end-to-end encrypted before upload.
              </p>
              {s3Connected ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-green-500">
                      ✓ {storedS3Config?.bucket ?? 'Connected'}
                    </span>
                    <Button variant="ghost" size="xs" onClick={onDisconnectS3}>Disconnect</Button>
                  </div>
                  <p className="text-[10px] text-[rgb(var(--text-3))]">
                    To change credentials, disconnect first then reconnect.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Field label="Endpoint URL" placeholder="https://xxxx.r2.cloudflarestorage.com"
                    type="url" value={s3Endpoint} onChange={setS3Endpoint} />
                  <Field label="Bucket name" placeholder="my-mindvault"
                    value={s3Bucket} onChange={setS3Bucket} mono />
                  <Field label="Region" placeholder="auto"
                    value={s3Region} onChange={setS3Region} mono />
                  <Field label="Access Key ID"
                    value={s3AccessKey} onChange={setS3AccessKey} mono />
                  <Field label="Secret Access Key" type="password"
                    value={s3SecretKey} onChange={setS3SecretKey} mono />
                  {s3Error && <p className="text-xs text-red-500">{s3Error}</p>}
                  <p className="text-[10px] text-[rgb(var(--text-3))]">
                    Make sure your bucket has CORS enabled for this origin.
                  </p>
                  <Button
                    variant="primary" size="xs"
                    onClick={() => void onSaveS3()}
                    disabled={s3Testing || !s3Endpoint || !s3Bucket || !s3AccessKey || !s3SecretKey}
                    className="w-full justify-center"
                  >
                    {s3Testing ? 'Testing…' : 'Test & Save'}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* WebDAV */}
          {syncProvider === 'webdav' && (
            <div className="space-y-2">
              <p className="text-xs text-[rgb(var(--text-2))]">
                Any WebDAV server — Nextcloud, ownCloud, Koofr, pCloud, Box, any NAS.
                Use an app password if your server supports it.
              </p>
              {webdavConnected ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-green-500">
                      ✓ {storedWebDAVConfig?.username ?? 'Connected'}
                    </span>
                    <Button variant="ghost" size="xs" onClick={onDisconnectWebDAV}>Disconnect</Button>
                  </div>
                  <p className="text-[10px] text-[rgb(var(--text-3))]">
                    To change credentials, disconnect first then reconnect.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Field
                    label="WebDAV URL"
                    placeholder="https://cloud.example.com/remote.php/dav/files/user/MindVault"
                    type="url"
                    value={davUrl}
                    onChange={setDavUrl}
                  />
                  <Field label="Username" value={davUsername} onChange={setDavUsername} />
                  <Field label="Password / App Password" type="password"
                    value={davPassword} onChange={setDavPassword} />
                  {davError && <p className="text-xs text-red-500">{davError}</p>}
                  <Button
                    variant="primary" size="xs"
                    onClick={() => void onSaveWebDAV()}
                    disabled={davTesting || !davUrl || !davUsername || !davPassword}
                    className="w-full justify-center"
                  >
                    {davTesting ? 'Connecting…' : 'Connect'}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Sync now / status footer */}
          {isConnected && (
            <div className="mt-3 flex items-center gap-2 border-t border-[rgb(var(--border))] pt-3">
              <Button
                variant="primary" size="xs"
                onClick={() => void handleSync()}
                disabled={syncStatus === 'syncing'}
                className="inline-flex items-center gap-1.5"
              >
                <RefreshCw size={11} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
                Sync Now
              </Button>
              <span className={`ml-auto text-xs ${
                syncStatus === 'ok'      ? 'text-green-500'  :
                syncStatus === 'error'   ? 'text-red-500'    :
                syncStatus === 'syncing' ? 'text-yellow-400' : 'text-[rgb(var(--text-3))]'
              }`}>
                {syncStatus}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
