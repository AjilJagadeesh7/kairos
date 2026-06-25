import { toast } from 'sonner'
import { useUpgradeStore } from '../store/useUpgradeStore'
import { getActiveLimits, getActiveTier, getLimits, nextTierFor } from './tierProvider'
import { TIER_LIMITS } from './tierLimits'
import { checkFileSize, formatBytes } from './checks'

/**
 * Gate any file/blob upload by size against the active tier. On rejection, shows a
 * toast and opens the upgrade modal (once per session). Returns true if allowed.
 *
 * Call this at the moment a File is selected — before it is base64-encoded and
 * embedded into note/board JSON.
 */
export function assertUploadSize(bytes: number, fileName?: string): boolean {
  if (checkFileSize(bytes)) return true

  const tier = getActiveTier()
  const limit = getActiveLimits().fileSizeBytes
  const upgrade = nextTierFor(tier, 'fileSizeBytes')
  const upgradeHint = upgrade
    ? ` Upgrade to ${TIER_LIMITS[upgrade].label} for ${formatBytes(getLimits(upgrade).fileSizeBytes)}.`
    : ''

  const label = fileName ? `"${fileName}" ` : 'File '
  toast.error(`${label}exceeds your plan's limit (${formatBytes(limit)}).${upgradeHint}`)
  useUpgradeStore.getState().trigger('file_size')
  return false
}
