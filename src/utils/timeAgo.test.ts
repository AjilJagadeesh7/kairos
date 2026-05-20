import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { timeAgo } from './timeAgo'

const NOW = new Date('2026-05-20T12:00:00Z')

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW) })
afterEach(() => { vi.useRealTimers() })

const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString()

describe('timeAgo', () => {
  it('30 seconds ago → "just now"', () => {
    expect(timeAgo(ago(30_000))).toBe('just now')
  })

  it('just under 1 minute → "just now"', () => {
    expect(timeAgo(ago(59_000))).toBe('just now')
  })

  it('5 minutes ago → "5m ago"', () => {
    expect(timeAgo(ago(5 * 60_000))).toBe('5m ago')
  })

  it('59 minutes ago → "59m ago"', () => {
    expect(timeAgo(ago(59 * 60_000))).toBe('59m ago')
  })

  it('3 hours ago → "3h ago"', () => {
    expect(timeAgo(ago(3 * 3_600_000))).toBe('3h ago')
  })

  it('23 hours ago → "23h ago"', () => {
    expect(timeAgo(ago(23 * 3_600_000))).toBe('23h ago')
  })

  it('2 days ago → "2d ago"', () => {
    expect(timeAgo(ago(2 * 86_400_000))).toBe('2d ago')
  })

  it('6 days ago → "6d ago"', () => {
    expect(timeAgo(ago(6 * 86_400_000))).toBe('6d ago')
  })

  it('10 days ago → locale date string (not a relative label)', () => {
    const result = timeAgo(ago(10 * 86_400_000))
    expect(result).not.toMatch(/ago/)
    expect(result).not.toBe('just now')
    // Should be something like "May 10" or "May 10, 2026"
    expect(result).toMatch(/May/)
  })
})
