import { describe, it, expect } from 'vitest'
import { condenseToFit, StoppedError } from './condense'
import { fitTurns, pageAllowance, promptBudget } from './budget'
import { estimateTokens } from '../text/tokens'
import { fakeProvider, longNote } from './__fixtures__/fakes'

/** Echoes the section marker so the test can see every part was read. */
function markerEcho(messages: { content: string }[]): string {
  const markers = messages[1].content.match(/MARKER\d+/g) ?? []
  return `Condensed: ${markers.join(' ')}`
}

describe('promptBudget', () => {
  it('uses the provider window, capped at 32k', () => {
    expect(promptBudget({ contextTokens: 4096 })).toBe(4096)
    expect(promptBudget({ contextTokens: 128_000 })).toBe(32_000)
    expect(promptBudget({ contextTokens: 0 })).toBe(8_000)
  })
})

describe('pageAllowance / fitTurns', () => {
  it('gives the page priority over chat turns', () => {
    const turns = [{ role: 'user' as const, content: 'x'.repeat(40_000) }]
    // History reserve is capped at 15% of the budget.
    expect(pageAllowance(8000, 500, turns)).toBe(Math.floor(8000 * 0.92) - 500 - 1200)
  })

  it('keeps at most the last 4 turns, newest first', () => {
    const turns = Array.from({ length: 6 }, (_, i) => ({ role: 'user' as const, content: `turn ${i}` }))
    expect(fitTurns(turns, 10_000).map((t) => t.content)).toEqual(['turn 2', 'turn 3', 'turn 4', 'turn 5'])
    expect(fitTurns(turns, 9).map((t) => t.content)).toEqual(['turn 5'])
  })
})

describe('condenseToFit', () => {
  it('returns short text unchanged without calling the model', async () => {
    const { provider, calls } = fakeProvider({ generate: () => 'x' })
    const out = await condenseToFit(provider, 'T', 'short note', { budget: 4000, target: 1000, isStopped: () => false })
    expect(out).toEqual({ text: 'short note', condensed: false, parts: 1 })
    expect(calls).toHaveLength(0)
  })

  it('map-reduces a long note: every section is read, the result fits', async () => {
    const md = longNote(12, 400)
    expect(estimateTokens(md)).toBeGreaterThan(3000)
    const { provider, calls } = fakeProvider({ generate: (m) => markerEcho(m) })
    const progress: number[] = []
    const out = await condenseToFit(provider, 'Long', md, {
      budget: 3000, target: 1500, isStopped: () => false, onProgress: (d) => progress.push(d),
    })
    expect(out.condensed).toBe(true)
    expect(out.parts).toBe(calls.length)
    expect(calls.length).toBeGreaterThan(1)
    expect(estimateTokens(out.text)).toBeLessThanOrEqual(1500)
    for (let s = 1; s <= 12; s++) expect(out.text).toContain(`MARKER${s}`)
    // Each map request stays inside the budget and has thinking off.
    for (const c of calls) {
      expect(estimateTokens(c.messages.map((m) => m.content).join(''))).toBeLessThan(3000)
      expect(c.opts.thinking).toBe(false)
    }
    expect(progress[0]).toBe(0)
  })

  it('runs another round when the joined parts are still too long', async () => {
    const md = longNote(10, 400)
    const { provider, calls } = fakeProvider({ generate: (m) => `${markerEcho(m)} ${'pad '.repeat(150)}` })
    const out = await condenseToFit(provider, 'Long', md, { budget: 3000, target: 400, isStopped: () => false })
    expect(out.condensed).toBe(true)
    expect(calls.length).toBeGreaterThan(out.parts)
  })

  it('fails clearly instead of truncating when it cannot fit', async () => {
    const { provider } = fakeProvider({ generate: () => 'pad '.repeat(400) })
    await expect(condenseToFit(provider, 'Long', longNote(10, 400), { budget: 3000, target: 50, isStopped: () => false }))
      .rejects.toThrow(/too long to summarize/)
  })

  it('stops between parts when asked', async () => {
    let stop = false
    const { provider, calls } = fakeProvider({ generate: () => { stop = true; return 'part' } })
    await expect(condenseToFit(provider, 'Long', longNote(10, 400), { budget: 3000, target: 500, isStopped: () => stop }))
      .rejects.toBeInstanceOf(StoppedError)
    expect(calls).toHaveLength(1)
  })
})
