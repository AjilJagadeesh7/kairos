import { describe, it, expect, beforeEach, vi } from 'vitest'

// Stub localStorage before logger module code runs
const makeLocalStorage = () => {
  let store: Record<string, string> = {}
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { store = {} },
  }
}
vi.stubGlobal('localStorage', makeLocalStorage())

// Dynamic import so the module initializes after the localStorage stub is set
const { logger } = await import('./logger')

beforeEach(() => {
  logger.clear()
})

describe('logger.info / warn / error', () => {
  it('info entry has level "info"', () => {
    logger.info('hello')
    expect(logger.getEntries().at(-1)?.level).toBe('info')
  })

  it('warn entry has level "warn"', () => {
    logger.warn('watch out')
    expect(logger.getEntries().at(-1)?.level).toBe('warn')
  })

  it('error entry has level "error"', () => {
    logger.error('boom')
    expect(logger.getEntries().at(-1)?.level).toBe('error')
  })

  it('stores the message', () => {
    logger.info('test message', 'ctx')
    const entry = logger.getEntries().at(-1)!
    expect(entry.msg).toBe('test message')
    expect(entry.context).toBe('ctx')
  })

  it('entry has an ISO timestamp', () => {
    logger.info('ts test')
    const { ts } = logger.getEntries().at(-1)!
    expect(() => new Date(ts).toISOString()).not.toThrow()
  })
})

describe('logger.captureError', () => {
  it('captures an Error object — uses its message and stack', () => {
    const err = new Error('test error')
    logger.captureError(err, 'test-ctx')
    const entry = logger.getEntries().at(-1)!
    expect(entry.msg).toBe('test error')
    expect(entry.stack).toContain('Error: test error')
    expect(entry.context).toBe('test-ctx')
  })

  it('handles non-Error rejection values', () => {
    logger.captureError('string rejection')
    expect(logger.getEntries().at(-1)?.msg).toBe('string rejection')
  })

  it('handles undefined gracefully', () => {
    expect(() => logger.captureError(undefined)).not.toThrow()
  })
})

describe('logger.getFormatted', () => {
  it('returns one JSON line per entry', () => {
    logger.info('a')
    logger.warn('b')
    const lines = logger.getFormatted().split('\n')
    expect(lines).toHaveLength(2)
    expect(() => JSON.parse(lines[0])).not.toThrow()
  })

  it('returns empty string when no entries', () => {
    expect(logger.getFormatted()).toBe('')
  })
})

describe('logger.clear', () => {
  it('empties the memory buffer', () => {
    logger.info('x')
    logger.clear()
    expect(logger.getEntries()).toHaveLength(0)
  })

  it('removes the localStorage key', () => {
    logger.info('x')
    logger.clear()
    expect(localStorage.getItem('mindvault_diagnostic_log')).toBeNull()
  })
})

describe('localStorage persistence', () => {
  it('entries are written to localStorage', () => {
    logger.info('persisted')
    const raw = localStorage.getItem('mindvault_diagnostic_log')
    expect(raw).not.toBeNull()
    const entries = JSON.parse(raw!)
    expect(entries.some((e: { msg: string }) => e.msg === 'persisted')).toBe(true)
  })
})
