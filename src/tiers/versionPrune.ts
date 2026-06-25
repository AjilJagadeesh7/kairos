import type { ContentVersion } from '../types'
import type { HistoryPolicy } from './checks'

/**
 * Apply a version-history retention policy: drop snapshots older than the window,
 * then cap the count (keeping the newest). The most recent snapshot is always
 * retained, so age pruning can never erase a note's entire history.
 *
 * Pure and deterministic — `versions` is assumed oldest → newest.
 */
export function pruneVersions(versions: ContentVersion[], policy: HistoryPolicy, now = Date.now()): ContentVersion[] {
  if (versions.length === 0) return versions
  let result = versions

  if (policy.maxAgeMs !== Infinity) {
    const cutoff = now - policy.maxAgeMs
    const kept = result.filter(v => new Date(v.savedAt).getTime() >= cutoff)
    result = kept.length > 0 ? kept : result.slice(-1)
  }

  if (policy.maxVersions !== Infinity && result.length > policy.maxVersions) {
    result = result.slice(-policy.maxVersions)
  }

  return result
}
