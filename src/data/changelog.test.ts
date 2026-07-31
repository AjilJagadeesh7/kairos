import { describe, it, expect } from 'vitest'
import { CHANGELOG } from './changelog'

/** Look an entry up by version, so parser assertions aren't pinned to "newest". */
const entry = (version: string) => {
  const found = CHANGELOG.find(e => e.version === version)
  if (!found) throw new Error(`No changelog entry for ${version}`)
  return found
}

describe('changelog parser', () => {
  it('parses at least the released versions, newest first', () => {
    expect(CHANGELOG.length).toBeGreaterThanOrEqual(3)
    expect(CHANGELOG[0].version).toBe('0.1.1')
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
    const v = entry('0.0.7')   // the release that dropped PDF export
    expect(v.removed?.some(i => i.includes('PDF export'))).toBe(true)
    expect(v.improved?.some(i => i.includes('PDF export'))).toBe(false)
  })

  it('strips markdown from bullets and intro text', () => {
    const joined = CHANGELOG.flatMap(e => [...e.highlights, ...(e.added ?? []), ...(e.fixed ?? [])]).join(' ')
    expect(joined).not.toContain('**')
    expect(joined).not.toContain('`')
    expect(joined).not.toMatch(/\]\(http/)
  })

  it('keeps the intro paragraph out of the change buckets', () => {
    const v = entry('0.0.7')
    expect(v.highlights.join(' ')).toContain('largest release')
    expect(v.added?.join(' ')).not.toContain('largest release')
  })

  it('parses the current release into the buckets it declares', () => {
    const v = entry('0.1.0')
    expect(v.date).toBe('2026-07-31')
    expect(v.added?.some(i => i.includes('Multi-select'))).toBe(true)
    expect(v.improved?.some(i => i.includes('templates rebuilt'))).toBe(true)
    expect(v.fixed?.some(i => i.includes('clipped by the sidebar'))).toBe(true)
  })
})
