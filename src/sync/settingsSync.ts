/**
 * Persists user settings to vault/config/settings.json.
 * On startup: reads and hydrates the Zustand store.
 * On change: writes the full settings snapshot.
 */
import { isPlainFolderConnected, readPlainConfig, writePlainConfig } from './plainFolder'
import type { S3Config } from './s3'
import type { WebDAVConfig } from './webdav'
import type { ThemeMode, StorageTarget, FontOption, FontWeight } from '../types'

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
  const { useAppStore } = await import('../store/useAppStore')
  const { theme, font, fontWeight, aiUrl, storageChoices, s3Config, webdavConfig } = useAppStore.getState()
  await saveSettings({ version: 1, theme, font, fontWeight, aiUrl, storageChoices, s3Config, webdavConfig })
}
