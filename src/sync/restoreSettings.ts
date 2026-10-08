/**
 * Startup restore of persisted settings + sync credentials.
 *
 * Sync secrets live in OS secure storage; the persisted configs (localStorage
 * and vault/config/settings.json) are redacted. A legacy plain-text secret is
 * moved into secure storage on first start and the file rewritten without it.
 */
import { useAppStore } from '../store/useAppStore'
import { resolveSyncCredentials } from '../secrets/syncCredentials'
import { setS3Config } from './s3'
import { setWebDAVConfig } from './webdav'

/** Fill the in-memory sync configs from secure storage. Runs before the vault is opened. */
export async function restoreSyncCredentials(): Promise<void> {
  const store = useAppStore.getState()
  const persisted = await resolveSyncCredentials(store.s3Config, store.webdavConfig)
  if (persisted.s3) { store.setS3Config(persisted.s3); setS3Config(persisted.s3) }
  if (persisted.webdav) { store.setWebDAVConfig(persisted.webdav); setWebDAVConfig(persisted.webdav) }
}

/** Apply vault/config/settings.json. Call only once the vault folder is open. */
export async function restoreVaultSettings(): Promise<void> {
  const { loadSettings, saveCurrentSettings } = await import('./settingsSync')
  const store = useAppStore.getState()
  const saved = await loadSettings()
  if (!saved) return

  const creds = await resolveSyncCredentials(saved.s3Config ?? null, saved.webdavConfig ?? null)

  if (saved.theme)       store.setTheme(saved.theme)
  if (saved.font)        store.setFont(saved.font)
  if (saved.fontWeight)  store.setFontWeight(saved.fontWeight)
  if (saved.fontSize)    store.setFontSize(saved.fontSize)
  if (saved.trashRetentionDays !== undefined) store.setTrashRetentionDays(saved.trashRetentionDays)
  if (saved.storageChoices) store.setStorageChoices(saved.storageChoices)
  if (saved.s3Config !== undefined) {
    store.setS3Config(creds.s3)
    if (creds.s3) setS3Config(creds.s3)
  }
  if (saved.webdavConfig !== undefined) {
    store.setWebDAVConfig(creds.webdav)
    if (creds.webdav) setWebDAVConfig(creds.webdav)
  }

  // Rewrite settings.json without the plain-text secrets it used to hold
  // (after the loaded values are applied, so nothing else changes).
  if (creds.migrated) void saveCurrentSettings()
}
