import { isDesktop } from '../../utils/platform'
import type { StorageAdapter } from './StorageAdapter'

let _adapter: StorageAdapter | null = null

export async function getStorageAdapter(): Promise<StorageAdapter> {
  if (_adapter) return _adapter

  if (isDesktop()) {
    const { TauriFSAdapter } = await import('./TauriFSAdapter')
    _adapter = new TauriFSAdapter()
    return _adapter
  }

  const { CapacitorFSAdapter } = await import('./CapacitorFSAdapter')
  _adapter = new CapacitorFSAdapter()
  return _adapter
}

/** Invalidate the cached adapter (e.g. after the user changes storage choice). */
export function resetStorageAdapter(): void {
  _adapter = null
}
