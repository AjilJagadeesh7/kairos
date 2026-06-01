/**
 * Settings persistence + cloud sync.
 *
 * Local: the full settings snapshot is written to vault/config/settings.json and
 * hydrated on startup (unchanged behaviour).
 *
 * Cloud (when connected): config is split so multiple devices on one endpoint
 * don't clobber each other:
 *   - config/settings.json        → shared prefs (theme, fonts, AI URL, colors…)
 *   - config/device-{deviceId}.json → device-specific prefs (storage choices)
 *   - config/secrets.json         → provider credentials (opt-in only)
 * Shared + device files sync with the `settings` scope; secrets with `secrets`.
 */
import { isPlainFolderConnected, readPlainConfig, writePlainConfig } from './plainFolder'
import { connectedProviders } from './remoteProvider'
import { canPush, canPull } from './syncRules'
import { getDeviceId } from './deviceId'
import { useAppStore } from '../store/useAppStore'
import { setS3Config } from './s3'
import { setWebDAVConfig } from './webdav'
import type { S3Config } from './s3'
import type { WebDAVConfig } from './webdav'
import type { ThemeMode, StorageTarget, FontOption, FontWeight, CustomCallout } from '../types'

export type PersistedSettings = {
  version: 1
  theme?: ThemeMode
  font?: FontOption
  fontWeight?: FontWeight
  aiUrl?: string
  storageChoices?: StorageTarget[]
  s3Config?: S3Config | null
  webdavConfig?: WebDAVConfig | null
}

const CONFIG_FILE = 'settings.json'

// ---------------------------------------------------------------------------
// Local snapshot (full) — unchanged
// ---------------------------------------------------------------------------

export async function saveSettings(settings: PersistedSettings): Promise<void> {
  if (!isPlainFolderConnected()) return
  try {
    await writePlainConfig(CONFIG_FILE, JSON.stringify({ ...settings, version: 1 }, null, 2))
  } catch (err) {
    console.warn('[settings] failed to save:', err)
  }
}

export async function loadSettings(): Promise<PersistedSettings | null> {
  if (!isPlainFolderConnected()) return null
  try {
    const raw = await readPlainConfig(CONFIG_FILE)
    if (!raw) return null
    return JSON.parse(raw) as PersistedSettings
  } catch (err) {
    console.warn('[settings] failed to load:', err)
    return null
  }
}

export async function saveCurrentSettings(): Promise<void> {
  const { theme, font, fontWeight, aiUrl, storageChoices, s3Config, webdavConfig } = useAppStore.getState()
  await saveSettings({ version: 1, theme, font, fontWeight, aiUrl, storageChoices, s3Config, webdavConfig })
  // Opportunistically mirror to the cloud (respects scope inside).
  void pushConfigToCloud()
}

// ---------------------------------------------------------------------------
// Cloud config payloads
// ---------------------------------------------------------------------------

type SharedSettings = {
  version: 1
  updatedAt: string
  theme?: ThemeMode
  font?: FontOption
  fontWeight?: FontWeight
  aiUrl?: string
  noteTagColors?: Record<string, string>
  calloutColors?: Record<string, string>
  customCallouts?: CustomCallout[]
  keyBindings?: Record<string, string>
  userName?: string
  newTabPage?: string
}

type DeviceSettings = { version: 1; updatedAt: string; storageChoices?: StorageTarget[] }
type SecretSettings = { version: 1; updatedAt: string; s3Config?: S3Config | null; webdavConfig?: WebDAVConfig | null }

const SHARED_FILE = 'settings.json'
const SECRETS_FILE = 'secrets.json'
const deviceFile = () => `device-${getDeviceId()}.json`

// Per-payload sync state in localStorage:
//   *_MTIME = effective last-modified time we publish for this payload. It only
//             advances when the content actually changes, or when we adopt a
//             newer remote — so the timestamp truly reflects the latest edit and
//             "newest wins" stays meaningful (no ping-pong between devices).
//   *_SNAP  = the JSON body last seen, used to detect a real change.
const SHARED_MTIME  = 'kairos_cfg_shared_at',  SHARED_SNAP  = 'kairos_cfg_shared_snap'
const DEVICE_MTIME  = 'kairos_cfg_device_at',  DEVICE_SNAP  = 'kairos_cfg_device_snap'
const SECRETS_MTIME = 'kairos_cfg_secrets_at', SECRETS_SNAP = 'kairos_cfg_secrets_snap'

/** Effective updatedAt for a body — bumped to now() only when it actually changed. */
function stamp(mtimeKey: string, snapKey: string, body: unknown): string {
  const json = JSON.stringify(body)
  if (localStorage.getItem(snapKey) !== json) {
    const now = new Date().toISOString()
    localStorage.setItem(snapKey, json)
    localStorage.setItem(mtimeKey, now)
    return now
  }
  return localStorage.getItem(mtimeKey) ?? new Date(0).toISOString()
}

/** Record that local now matches an adopted remote (so we don't re-push it). */
function adopt(mtimeKey: string, snapKey: string, body: unknown, remoteAt: string): void {
  localStorage.setItem(snapKey, JSON.stringify(body))
  localStorage.setItem(mtimeKey, remoteAt)
}

function remoteIsNewer(remoteAt: string, mtimeKey: string): boolean {
  const local = localStorage.getItem(mtimeKey)
  return !local || new Date(remoteAt) > new Date(local)
}

// Body builders read straight from the store — used by both push and adopt so
// the change-detection snapshot always matches what we would publish.
function sharedBody() {
  const s = useAppStore.getState()
  return {
    theme: s.theme, font: s.font, fontWeight: s.fontWeight, aiUrl: s.aiUrl,
    noteTagColors: s.noteTagColors, calloutColors: s.calloutColors, customCallouts: s.customCallouts,
    keyBindings: s.keyBindings, userName: s.userName, newTabPage: s.newTabPage,
  }
}
function deviceBody()  { return { storageChoices: useAppStore.getState().storageChoices } }
function secretsBody() { const s = useAppStore.getState(); return { s3Config: s.s3Config, webdavConfig: s.webdavConfig } }

function buildShared(): SharedSettings {
  const body = sharedBody()
  return { version: 1, updatedAt: stamp(SHARED_MTIME, SHARED_SNAP, body), ...body }
}
function buildDevice(): DeviceSettings {
  const body = deviceBody()
  return { version: 1, updatedAt: stamp(DEVICE_MTIME, DEVICE_SNAP, body), ...body }
}
function buildSecrets(): SecretSettings {
  const body = secretsBody()
  return { version: 1, updatedAt: stamp(SECRETS_MTIME, SECRETS_SNAP, body), ...body }
}

// ---------------------------------------------------------------------------
// Push
// ---------------------------------------------------------------------------

export async function pushConfigToCloud(): Promise<void> {
  const settingsTargets = connectedProviders().filter((p) => canPush('settings', p.id))
  const secretsTargets  = connectedProviders().filter((p) => canPush('secrets', p.id))

  if (settingsTargets.length > 0) {
    const shared = JSON.stringify(buildShared(), null, 2)
    const device = JSON.stringify(buildDevice(), null, 2)
    await Promise.allSettled(settingsTargets.flatMap((p) => [
      p.putBlob('settings', SHARED_FILE, shared),
      p.putBlob('settings', deviceFile(), device),
    ]))
  }

  if (secretsTargets.length > 0) {
    const secrets = JSON.stringify(buildSecrets(), null, 2)
    await Promise.allSettled(secretsTargets.map((p) => p.putBlob('secrets', SECRETS_FILE, secrets)))
  }
}

// ---------------------------------------------------------------------------
// Pull
// ---------------------------------------------------------------------------

function newest<T extends { updatedAt: string }>(items: T[]): T | null {
  let best: T | null = null
  for (const it of items) {
    if (!best || new Date(it.updatedAt) > new Date(best.updatedAt)) best = it
  }
  return best
}

async function pullConfigFromCloud(): Promise<void> {
  const store = useAppStore.getState()

  const settingsSources = connectedProviders().filter((p) => canPull('settings', p.id))
  if (settingsSources.length > 0) {
    const shareds: SharedSettings[] = []
    const devices: DeviceSettings[] = []
    const myDevice = deviceFile()
    for (const p of settingsSources) {
      let blobs
      try { blobs = await p.listBlob('settings') } catch (err) { console.warn(`[settings] ${p.id} list failed:`, err); continue }
      for (const blob of blobs) {
        try {
          if (blob.name === SHARED_FILE) shareds.push(JSON.parse(blob.content) as SharedSettings)
          else if (blob.name === myDevice) devices.push(JSON.parse(blob.content) as DeviceSettings)
        } catch { /* skip malformed */ }
      }
    }

    const shared = newest(shareds)
    if (shared && remoteIsNewer(shared.updatedAt, SHARED_MTIME)) {
      store.applySharedSettings({
        theme: shared.theme, font: shared.font, fontWeight: shared.fontWeight, aiUrl: shared.aiUrl,
        noteTagColors: shared.noteTagColors, calloutColors: shared.calloutColors, customCallouts: shared.customCallouts,
        keyBindings: shared.keyBindings, userName: shared.userName, newTabPage: shared.newTabPage,
      })
      adopt(SHARED_MTIME, SHARED_SNAP, sharedBody(), shared.updatedAt)
    }

    const device = newest(devices)
    if (device && remoteIsNewer(device.updatedAt, DEVICE_MTIME)) {
      if (device.storageChoices) store.setStorageChoices(device.storageChoices)
      adopt(DEVICE_MTIME, DEVICE_SNAP, deviceBody(), device.updatedAt)
    }
  }

  const secretsSources = connectedProviders().filter((p) => canPull('secrets', p.id))
  if (secretsSources.length > 0) {
    const secrets: SecretSettings[] = []
    for (const p of secretsSources) {
      let blobs
      try { blobs = await p.listBlob('secrets') } catch { continue }
      for (const blob of blobs) {
        if (blob.name !== SECRETS_FILE) continue
        try { secrets.push(JSON.parse(blob.content) as SecretSettings) } catch { /* skip */ }
      }
    }
    const secret = newest(secrets)
    if (secret && remoteIsNewer(secret.updatedAt, SECRETS_MTIME)) {
      if (secret.s3Config !== undefined) { store.setS3Config(secret.s3Config); setS3Config(secret.s3Config) }
      if (secret.webdavConfig !== undefined) { store.setWebDAVConfig(secret.webdavConfig); setWebDAVConfig(secret.webdavConfig) }
      adopt(SECRETS_MTIME, SECRETS_SNAP, secretsBody(), secret.updatedAt)
    }
  }
}

/** Full two-way config sync — pull newer remote config, then publish ours. */
export async function syncConfigWithCloud(): Promise<void> {
  await pullConfigFromCloud()
  await pushConfigToCloud()
}
