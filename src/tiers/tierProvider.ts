import { useTierStore } from '../store/useTierStore'
import { TIER_LIMITS, TIER_ORDER } from './tierLimits'
import type { KairosTier, TierLimits } from '../types'

/**
 * A source of the user's current tier. Today the only implementation reads from
 * local app config (useTierStore). When hosted sync ships, add a `jwtSource` that
 * decodes the entitlement from the server JWT and swap `activeSource` below — no
 * other call site changes.
 */
export interface TierSource {
  getTier(): KairosTier
}

const localConfigSource: TierSource = {
  getTier: () => useTierStore.getState().tier,
}

const activeSource: TierSource = localConfigSource

/** Current tier for non-React code (stores, sync, utils). */
export function getActiveTier(): KairosTier {
  return activeSource.getTier()
}

/** Limits for the current tier. */
export function getActiveLimits(): TierLimits {
  return TIER_LIMITS[getActiveTier()]
}

export function getLimits(tier: KairosTier): TierLimits {
  return TIER_LIMITS[tier]
}

/** The next tier up that actually raises `limit` for a given limit key, or null. */
export function nextTierFor(
  tier: KairosTier,
  key: keyof Pick<TierLimits, 'fileSizeBytes' | 'syncStorageBytes' | 'publishStorageBytes' | 'historyMaxVersions'>,
): KairosTier | null {
  const current = TIER_LIMITS[tier][key]
  const start = TIER_ORDER.indexOf(tier)
  for (let i = start + 1; i < TIER_ORDER.length; i++) {
    if (TIER_LIMITS[TIER_ORDER[i]][key] > current) return TIER_ORDER[i]
  }
  return null
}
