import { formatBytes } from './checks'
import { getActiveTier, getLimits, nextTierFor } from './tierProvider'
import { TIER_LIMITS } from './tierLimits'
import type { KairosTier, TierLimits, UpgradeReason } from '../types'

export interface UpgradeCopy {
  title: string
  /** Description of the current limit being hit. */
  currentLimit: string
  /** What the recommended upgrade unlocks. */
  unlocks: string
  /** Recommended tier to upgrade to, or null if already at the top. */
  targetTier: KairosTier | null
  /** Monthly price (billed annually) of the target tier. */
  priceAnnual: number | null
}

type LimitKey = Parameters<typeof nextTierFor>[1]

const REASON_KEY: Record<UpgradeReason, LimitKey> = {
  file_size: 'fileSizeBytes',
  sync_storage_full: 'syncStorageBytes',
  history: 'historyMaxVersions',
  publish_storage_full: 'publishStorageBytes',
}

function describe(reason: UpgradeReason, limits: TierLimits): string {
  switch (reason) {
    case 'file_size':            return `Your plan caps uploads at ${formatBytes(limits.fileSizeBytes)} per file.`
    case 'sync_storage_full':    return `You've used all ${formatBytes(limits.syncStorageBytes)} of sync storage.`
    case 'history':              return `Your plan keeps ${limits.historyMaxVersions} versions for ${limits.historyMonths} months.`
    case 'publish_storage_full': return `You've used all ${formatBytes(limits.publishStorageBytes)} of publish storage.`
  }
}

function unlock(reason: UpgradeReason, t: TierLimits): string {
  switch (reason) {
    case 'file_size':            return `${formatBytes(t.fileSizeBytes)} per-file uploads`
    case 'sync_storage_full':    return `${formatBytes(t.syncStorageBytes)} of sync storage`
    case 'history':              return `${t.historyMaxVersions} versions kept for ${t.historyMonths} months`
    case 'publish_storage_full': return `${formatBytes(t.publishStorageBytes)} of publish storage`
  }
}

export function getUpgradeCopy(reason: UpgradeReason): UpgradeCopy {
  const tier = getActiveTier()
  const target = nextTierFor(tier, REASON_KEY[reason])
  return {
    title: TITLES[reason],
    currentLimit: describe(reason, getLimits(tier)),
    unlocks: target ? unlock(reason, getLimits(target)) : '',
    targetTier: target,
    priceAnnual: target ? TIER_LIMITS[target].priceAnnual : null,
  }
}

const TITLES: Record<UpgradeReason, string> = {
  file_size: 'File too large for your plan',
  sync_storage_full: 'Sync storage full',
  history: 'Unlock longer version history',
  publish_storage_full: 'Publish storage full',
}
