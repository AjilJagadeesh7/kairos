import { describe, it, expect } from 'vitest'
import { pruneVersions } from './versionPrune'
import type { ContentVersion } from '../types'

const NOW = new Date('2026-06-18T12:00:00Z').getTime()
const DAY = 86400000

function v(daysAgo: number, content = 'x'): ContentVersion {
  return { savedAt: new Date(NOW - daysAgo * DAY).toISOString(), content }
}

describe('pruneVersions', () => {
  it('caps the count, keeping the newest', () => {
    const versions = [v(5, 'a'), v(4, 'b'), v(3, 'c'), v(2, 'd')]
    const result = pruneVersions(versions, { maxVersions: 2, maxAgeMs: Infinity }, NOW)
    expect(result.map(r => r.content)).toEqual(['c', 'd'])
  })

  it('drops snapshots older than the window', () => {
    const versions = [v(100, 'old'), v(40, 'old2'), v(10, 'recent')]
    const result = pruneVersions(versions, { maxVersions: Infinity, maxAgeMs: 30 * DAY }, NOW)
    expect(result.map(r => r.content)).toEqual(['recent'])
  })

  it('always keeps the latest even when it is older than the window', () => {
    const versions = [v(200, 'a'), v(120, 'b')]
    const result = pruneVersions(versions, { maxVersions: 30, maxAgeMs: 90 * DAY }, NOW)
    expect(result.map(r => r.content)).toEqual(['b'])
  })

  it('applies age window then count cap', () => {
    const versions = [v(100), v(20, 'k1'), v(15, 'k2'), v(10, 'k3')]
    const result = pruneVersions(versions, { maxVersions: 2, maxAgeMs: 30 * DAY }, NOW)
    expect(result.map(r => r.content)).toEqual(['k2', 'k3'])
  })

  it('returns empty input unchanged', () => {
    expect(pruneVersions([], { maxVersions: 5, maxAgeMs: DAY }, NOW)).toEqual([])
  })
})
