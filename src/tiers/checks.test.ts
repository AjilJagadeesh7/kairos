import { describe, it, expect } from 'vitest'
import { checkFileSize, getHistoryPolicy, getQuota, formatBytes, byteLength } from './checks'
import { nextTierFor } from './tierProvider'

const MB = 1024 * 1024
const GB = 1024 * MB

describe('checkFileSize', () => {
  it('free tier allows any size (unlimited)', () => {
    expect(checkFileSize(500 * MB, 'free')).toBe(true)
  })
  it('sync tier allows up to 50MB and rejects above', () => {
    expect(checkFileSize(50 * MB, 'sync')).toBe(true)
    expect(checkFileSize(50 * MB + 1, 'sync')).toBe(false)
  })
  it('pro tier allows up to 200MB', () => {
    expect(checkFileSize(200 * MB, 'pro')).toBe(true)
    expect(checkFileSize(200 * MB + 1, 'pro')).toBe(false)
  })
})

describe('getHistoryPolicy', () => {
  it('maps each tier to count + age window', () => {
    expect(getHistoryPolicy('sync')).toEqual({ maxVersions: 30, maxAgeMs: 3 * 30 * 86400000 })
    expect(getHistoryPolicy('sync_publish')).toEqual({ maxVersions: 50, maxAgeMs: 6 * 30 * 86400000 })
    expect(getHistoryPolicy('pro').maxVersions).toBe(100)
  })
})

describe('getQuota', () => {
  it('free is local-only (0 sync, 0 publish)', () => {
    expect(getQuota('free')).toEqual({ syncBytes: 0, publishBytes: 0 })
  })
  it('sync has 2GB sync but no publish', () => {
    expect(getQuota('sync')).toEqual({ syncBytes: 2 * GB, publishBytes: 0 })
  })
  it('pro has 10GB each', () => {
    expect(getQuota('pro')).toEqual({ syncBytes: 10 * GB, publishBytes: 10 * GB })
  })
})

describe('nextTierFor', () => {
  it('finds the next tier that raises file size', () => {
    expect(nextTierFor('free', 'fileSizeBytes')).toBe(null) // free is already unlimited
    expect(nextTierFor('sync', 'fileSizeBytes')).toBe('pro') // sync_publish is same 50MB
  })
  it('finds the next tier that adds publish storage', () => {
    expect(nextTierFor('sync', 'publishStorageBytes')).toBe('sync_publish')
  })
  it('returns null at the top tier', () => {
    expect(nextTierFor('pro', 'syncStorageBytes')).toBe(null)
  })
})

describe('formatBytes', () => {
  it('formats common sizes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(50 * MB)).toBe('50 MB')
    expect(formatBytes(2 * GB)).toBe('2 GB')
    expect(formatBytes(Infinity)).toBe('Unlimited')
  })
})

describe('byteLength', () => {
  it('counts UTF-8 bytes, not code units', () => {
    expect(byteLength('abc')).toBe(3)
    expect(byteLength('€')).toBe(3)
  })
})
