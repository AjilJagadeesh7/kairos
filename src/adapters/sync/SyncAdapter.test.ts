import { describe, it, expect } from 'vitest'
import { extractUpdatedAt, lastWriteWins } from './SyncAdapter'

function serialized(updatedAt: string, extra = ''): string {
  return `---\ntitle: Note\nupdatedAt: ${updatedAt}\n---\n${extra}`
}

describe('extractUpdatedAt', () => {
  it('parses a valid ISO timestamp', () => {
    const ms = extractUpdatedAt(serialized('2026-05-20T12:00:00.000Z'))
    expect(ms).toBe(new Date('2026-05-20T12:00:00.000Z').getTime())
  })

  it('returns 0 when updatedAt is missing', () => {
    expect(extractUpdatedAt('---\ntitle: Note\n---\ncontent')).toBe(0)
  })

  it('returns 0 for empty string', () => {
    expect(extractUpdatedAt('')).toBe(0)
  })

  it('trims whitespace around the value', () => {
    const ms = extractUpdatedAt('updatedAt:  2026-01-01T00:00:00.000Z  ')
    expect(ms).toBe(new Date('2026-01-01T00:00:00.000Z').getTime())
  })
})

describe('lastWriteWins', () => {
  it('returns the more recent version (remote wins)', () => {
    const local  = serialized('2026-05-01T00:00:00.000Z', 'old content')
    const remote = serialized('2026-05-20T00:00:00.000Z', 'new content')
    expect(lastWriteWins(local, remote)).toBe(remote)
  })

  it('returns the more recent version (local wins)', () => {
    const local  = serialized('2026-05-20T00:00:00.000Z', 'new content')
    const remote = serialized('2026-05-01T00:00:00.000Z', 'old content')
    expect(lastWriteWins(local, remote)).toBe(local)
  })

  it('returns local when timestamps are equal (tie-breaks to local)', () => {
    const ts = '2026-05-10T00:00:00.000Z'
    const local  = serialized(ts, 'local')
    const remote = serialized(ts, 'remote')
    expect(lastWriteWins(local, remote)).toBe(local)
  })

  it('returns local when both are missing timestamps', () => {
    expect(lastWriteWins('no-ts', 'no-ts')).toBe('no-ts')
  })
})
