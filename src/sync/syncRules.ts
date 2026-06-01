/**
 * Reads the user's sync matrix from the app store. The matrix is device-local
 * (never synced) — each device decides independently what it pushes to / pulls
 * from each provider.
 *
 * `canPush(category, provider)` / `canPull(category, provider)` are the single
 * source of truth the orchestrator consults before touching any remote.
 */
import { useAppStore } from '../store/useAppStore'
import { DEFAULT_SYNC_RULES } from '../types'
import type { SyncCategory, SyncProviderId, SyncRules } from '../types'

export function getSyncRules(): SyncRules {
  return useAppStore.getState().syncRules ?? DEFAULT_SYNC_RULES
}

/** Should `category` be pushed (local→remote) to `provider`? */
export function canPush(category: SyncCategory, provider: SyncProviderId): boolean {
  return getSyncRules()[category]?.[provider]?.push ?? false
}

/** Should `category` be pulled (remote→local) from `provider`? */
export function canPull(category: SyncCategory, provider: SyncProviderId): boolean {
  return getSyncRules()[category]?.[provider]?.pull ?? false
}
