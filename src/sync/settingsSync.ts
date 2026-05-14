/**
 * Persists user settings to config/settings.json inside the sync folder.
 * On startup: reads from the folder and hydrates the Zustand store.
 * On change: writes the full settings snapshot.
 *
 * This makes settings portable across devices — connect the same sync
 * folder on a new device and everything is restored automatically.
 */
import { isLocalFolderConnected, writeToSyncSubdir, readFromSyncSubdir } from './localFolder'
import type { S3Config } from './s3'
import type { WebDAVConfig } from './webdav'
import type { ThemeMode, StorageTarget } from '../types'

export type PersistedSettings = {
  version: 1
  theme?: ThemeMode
  aiUrl?: string
  storageChoices?: StorageTarget[]
  s3Config?: S3Config | null
  webdavConfig?: WebDAVConfig | null
}

const CONFIG_SUBDIR = 'config'
const CONFIG_FILE   = 'settings.json'

export async function saveSettings(settings: PersistedSettings): Promise<void> {
  if (!isLocalFolderConnected()) return
  try {
    await writeToSyncSubdir(CONFIG_SUBDIR, CONFIG_FILE, JSON.stringify({ ...settings, version: 1 }, null, 2))
  } catch (err) {
    console.warn('[settings] failed to save to sync folder:', err)
  }
}

export async function loadSettings(): Promise<PersistedSettings | null> {
  if (!isLocalFolderConnected()) return null
  try {
    const raw = await readFromSyncSubdir(CONFIG_SUBDIR, CONFIG_FILE)
    if (!raw) return null
    return JSON.parse(raw) as PersistedSettings
  } catch (err) {
    console.warn('[settings] failed to load from sync folder:', err)
    return null
  }
}

/** Collect all current settings from the store and write to the config folder. */
export async function saveCurrentSettings(): Promise<void> {
  const { useAppStore } = await import('../store/useAppStore')
  const { theme, aiUrl, storageChoices, s3Config, webdavConfig } = useAppStore.getState()
  await saveSettings({ version: 1, theme, aiUrl, storageChoices, s3Config, webdavConfig })
}
