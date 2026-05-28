import { describe, it, expect, afterEach, vi } from 'vitest'
import { todayDate } from './useJournalStore'

describe('todayDate', () => {
  afterEach(() => { vi.useRealTimers() })

  it('returns YYYY-MM-DD format', () => {
    expect(todayDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('returns the correct date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-20T15:00:00Z'))
    expect(todayDate()).toBe('2026-05-20')
  })

  it('zero-pads month and day', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-05T00:00:00Z'))
    expect(todayDate()).toBe('2026-01-05')
  })
})
