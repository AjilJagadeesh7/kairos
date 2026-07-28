import { describe, it, expect } from 'vitest'
import { CHANGELOG } from './changelog'

describe('changelog parser', () => {
  it('parses at least the released versions, newest first', () => {
    expect(CHANGELOG.length).toBeGreaterThanOrEqual(3)
    expect(CHANGELOG[0].version).toBe('0.0.7')
    expect(CHANGELOG.map(e => e.version)).toContain('0.0.5')
  })

  it('gives every entry a version, a date and at least one change', () => {
    for (const entry of CHANGELOG) {
      expect(entry.version).toMatch(/^\d+\.\d+\.\d+$/)
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      const total =
        (entry.added?.length ?? 0) + (entry.improved?.length ?? 0) +
        (entry.removed?.length ?? 0) + (entry.fixed?.length ?? 0)
      expect(total).toBeGreaterThan(0)
    }
  })

  it('files removals under `removed`, not `improved`', () => {
    const latest = CHANGELOG[0]
    expect(latest.removed?.some(i => i.includes('PDF export'))).toBe(true)
    expect(latest.improved?.some(i => i.includes('PDF export'))).toBe(false)
  })

  it('strips markdown from bullets and intro text', () => {
    const joined = CHANGELOG.flatMap(e => [...e.highlights, ...(e.added ?? []), ...(e.fixed ?? [])]).join(' ')
    expect(joined).not.toContain('**')
    expect(joined).not.toContain('`')
    expect(joined).not.toMatch(/\]\(http/)
  })

  it('keeps the intro paragraph out of the change buckets', () => {
    const latest = CHANGELOG[0]
    expect(latest.highlights.join(' ')).toContain('largest release')
    expect(latest.added?.join(' ')).not.toContain('largest release')
  })
})
