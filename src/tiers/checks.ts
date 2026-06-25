import { getActiveLimits, getActiveTier, getLimits } from './tierProvider'
import type { KairosTier } from '../types'

const MONTH_MS = 30 * 24 * 60 * 60 * 1000

export function formatBytes(bytes: number): string {
  if (!isFinite(bytes)) return 'Unlimited'
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, i)
  const rounded = value >= 100 || i === 0 ? Math.round(value) : Math.round(value * 10) / 10
  return `${rounded} ${units[i]}`
}

/** True when a file of `bytes` is allowed under `tier` (defaults to the active tier). */
export function checkFileSize(bytes: number, tier: KairosTier = getActiveTier()): boolean {
  return bytes <= getLimits(tier).fileSizeBytes
}

export interface HistoryPolicy {
  /** Max snapshots retained per item. Infinity = unlimited. */
  maxVersions: number
  /** Max age of a retained snapshot in ms. Infinity = unlimited. */
  maxAgeMs: number
}

export function getHistoryPolicy(tier: KairosTier = getActiveTier()): HistoryPolicy {
  const limits = getLimits(tier)
  return {
    maxVersions: limits.historyMaxVersions,
    maxAgeMs: limits.historyMonths === Infinity ? Infinity : limits.historyMonths * MONTH_MS,
  }
}

export interface Quota {
  syncBytes: number
  publishBytes: number
}

export function getQuota(tier: KairosTier = getActiveTier()): Quota {
  const limits = getLimits(tier)
  return { syncBytes: limits.syncStorageBytes, publishBytes: limits.publishStorageBytes }
}

/** Byte length of a UTF-8 string. */
export function byteLength(str: string): number {
  return new TextEncoder().encode(str).length
}

export { getActiveLimits, getActiveTier }
