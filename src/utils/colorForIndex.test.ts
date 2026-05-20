import { describe, it, expect } from 'vitest'
import { colorForIndex } from './colorForIndex'

describe('colorForIndex', () => {
  it('returns a valid hsl string', () => {
    expect(colorForIndex(0)).toMatch(/^hsl\(\d+(\.\d+)?, 72%, 62%\)$/)
  })

  it('is deterministic — same index always gives same color', () => {
    expect(colorForIndex(5)).toBe(colorForIndex(5))
  })

  it('produces different colors for different indices', () => {
    expect(colorForIndex(0)).not.toBe(colorForIndex(1))
  })

  it('hue stays within 0–360', () => {
    for (let i = 0; i < 100; i++) {
      const match = colorForIndex(i).match(/hsl\((\d+(?:\.\d+)?)/)
      const hue = parseFloat(match![1])
      expect(hue).toBeGreaterThanOrEqual(0)
      expect(hue).toBeLessThan(360)
    }
  })

  it('large index does not throw', () => {
    expect(() => colorForIndex(10_000)).not.toThrow()
  })
})
