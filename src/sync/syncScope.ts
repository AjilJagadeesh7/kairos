/**
 * Reads the user's per-category sync scope from the app store.
 * The scope is device-local (never synced) — each device decides independently
 * what it pushes to / pulls from the cloud.
 */
import { useAppStore } from '../store/useAppStore'
import { DEFAULT_SYNC_SCOPE } from '../types'
import type { SyncCategory, SyncScope } from '../types'

export function getSyncScope(): SyncScope {
  return useAppStore.getState().syncScope ?? DEFAULT_SYNC_SCOPE
}

/** Can this category be pushed local→cloud? */
export function canPush(category: SyncCategory): boolean {
  return getSyncScope()[category]?.push ?? false
}

/** Can this category be pulled cloud→local? */
export function canPull(category: SyncCategory): boolean {
  return getSyncScope()[category]?.pull ?? false
}
