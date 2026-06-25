import { toast } from 'sonner'
import { useStorageStore } from '../store/useStorageStore'
import { useUpgradeStore } from '../store/useUpgradeStore'
import { getActiveLimits } from './tierProvider'
import { byteLength } from './checks'

/** True if sync storage is at or over the active tier's quota (uses cached usage). */
export function isSyncStorageFull(): boolean {
  const { syncStorageBytes } = getActiveLimits()
  if (syncStorageBytes === 0 || !isFinite(syncStorageBytes)) return false // local-only or unlimited
  const usage = useStorageStore.getState().usage
  if (!usage) return false
  return usage.sync.total >= syncStorageBytes
}

let warnedFull = false

/** Returns true if sync may proceed. When full, warns once and prompts an upgrade. */
export function guardSyncQuota(): boolean {
  if (!isSyncStorageFull()) {
    warnedFull = false
    return true
  }
  if (!warnedFull) {
    warnedFull = true
    toast.error("Sync storage full — new changes won't upload.", {
      description: 'Free up space in Settings → Storage, or upgrade your plan.',
    })
    useUpgradeStore.getState().trigger('sync_storage_full')
  }
  return false
}

/** Backstop: true if a single serialized blob exceeds the per-file size limit. */
export function exceedsFileLimit(content: string): boolean {
  const { fileSizeBytes } = getActiveLimits()
  if (!isFinite(fileSizeBytes)) return false
  if (byteLength(content) <= fileSizeBytes) return false
  useUpgradeStore.getState().trigger('file_size')
  return true
}
