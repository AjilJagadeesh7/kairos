// Pricing tiers. Stored in local app config today; later sourced from a server JWT
// via a swappable TierSource (see src/tiers/tierProvider.ts).
export type KairosTier = 'free' | 'sync' | 'sync_publish' | 'pro'

export interface TierLimits {
  /** Display name, e.g. "Sync + Publish" */
  label: string
  /** Price in USD per month, billed annually (display only) */
  priceAnnual: number
  /** Price in USD per month, billed monthly (display only) */
  priceMonthly: number
  /** Cloud sync storage quota in bytes. 0 = local only (no cloud sync). */
  syncStorageBytes: number
  /** Published-site storage quota in bytes. 0 = publishing not available. */
  publishStorageBytes: number
  /** Max single-file/upload size in bytes. Infinity = unlimited. */
  fileSizeBytes: number
  /** Version-history retention window in months. Infinity = unlimited. */
  historyMonths: number
  /** Max version snapshots retained per item. Infinity = unlimited. */
  historyMaxVersions: number
  /** Max vaults. Kept for completeness; multi-vault is not enforced yet. */
  vaults: number
}

export interface StorageBreakdown {
  notes: number
  attachments: number
  versions: number
  total: number
}

export interface StorageUsage {
  sync: StorageBreakdown
  publish: { total: number }
}

/** Distinct enforcement blocks; used to show an upgrade modal at most once per session. */
export type UpgradeReason =
  | 'file_size'
  | 'sync_storage_full'
  | 'history'
  | 'publish_storage_full'
