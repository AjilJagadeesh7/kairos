import type { KairosTier, TierLimits } from '../types'

const GB = 1024 * 1024 * 1024
const MB = 1024 * 1024

/** Canonical tier definitions. Single source of truth for limits and pricing. */
export const TIER_LIMITS: Record<KairosTier, TierLimits> = {
  free: {
    label: 'Free',
    priceAnnual: 0,
    priceMonthly: 0,
    syncStorageBytes: 0,            // local only — no cloud sync
    publishStorageBytes: 0,         // no publishing
    fileSizeBytes: Infinity,        // unlimited (local files only)
    historyMonths: 3,               // history kept locally only
    historyMaxVersions: 30,
    vaults: 1,
  },
  sync: {
    label: 'Sync',
    priceAnnual: 3,
    priceMonthly: 4,
    syncStorageBytes: 2 * GB,
    publishStorageBytes: 0,
    fileSizeBytes: 50 * MB,
    historyMonths: 3,
    historyMaxVersions: 30,
    vaults: 3,
  },
  sync_publish: {
    label: 'Sync + Publish',
    priceAnnual: 6,
    priceMonthly: 8,
    syncStorageBytes: 2 * GB,
    publishStorageBytes: 4 * GB,
    fileSizeBytes: 50 * MB,
    historyMonths: 6,
    historyMaxVersions: 50,
    vaults: 5,
  },
  pro: {
    label: 'Pro',
    priceAnnual: 10,
    priceMonthly: 13,
    syncStorageBytes: 10 * GB,
    publishStorageBytes: 10 * GB,
    fileSizeBytes: 200 * MB,
    historyMonths: 12,
    historyMaxVersions: 100,
    vaults: Infinity,
  },
}

/** Ordered low → high; used to find the next tier that lifts a given limit. */
export const TIER_ORDER: KairosTier[] = ['free', 'sync', 'sync_publish', 'pro']
