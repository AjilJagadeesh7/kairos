import { getPlatform, supportsWebFS } from '../../utils/platform'
import type { StorageAdapter } from './StorageAdapter'
import { IndexDBAdapter } from './IndexDBAdapter'

let _adapter: StorageAdapter | null = null

/**
 * Runtime storage adapter resolution.
 *
 * desktop  → TauriFSAdapter   (reads/writes real .md files via Tauri plugin-fs)
 * mobile   → CapacitorFSAdapter (Documents/MindVault/ via Capacitor Filesystem)
 * web      → WebFSAdapter     (local folder via File System Access API, Chrome/Edge)
 *            or IndexDBAdapter  (universal fallback)
 *
 * Web users who haven't made a storage choice yet get IndexDB by default.
 * The onboarding banner in the UI prompts them to switch if they prefer a
 * local folder (requires Chrome/Edge with showDirectoryPicker support).
 */
export async function getStorageAdapter(): Promise<StorageAdapter> {
  if (_adapter) return _adapter

  const platform = getPlatform()

  if (platform === 'desktop') {
    const { TauriFSAdapter } = await import('./TauriFSAdapter')
    _adapter = new TauriFSAdapter()
    return _adapter
  }

  if (platform === 'mobile') {
    const { CapacitorFSAdapter } = await import('./CapacitorFSAdapter')
    _adapter = new CapacitorFSAdapter()
    return _adapter
  }

  // Web platform
  const choice = localStorage.getItem('mindvault_storage_choice')

  if (choice === 'local' && supportsWebFS()) {
    const { WebFSAdapter } = await import('./WebFSAdapter')
    const adapter = new WebFSAdapter()
    await adapter.init()
    _adapter = adapter
    return _adapter
  }

  _adapter = new IndexDBAdapter()
  return _adapter
}

/** Invalidate the cached adapter (e.g. after the user changes storage choice). */
export function resetStorageAdapter(): void {
  _adapter = null
}

/** True when the current platform supports local-folder storage. */
export function supportsLocalFolderStorage(): boolean {
  return getPlatform() === 'desktop'
    || getPlatform() === 'mobile'
    || supportsWebFS()
}
