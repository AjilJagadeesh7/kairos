import { describe, it, expect, beforeEach } from 'vitest'
import { useSelectionStore, exitSelection } from './useSelectionStore'

const ORDER = ['a', 'b', 'c', 'd', 'e']
const s = () => useSelectionStore.getState()
const selected = () => [...s().ids]

beforeEach(() => {
  useSelectionStore.setState({ scope: null, ids: new Set(), order: [], anchor: null })
})

describe('useSelectionStore', () => {
  it('enter sets the scope and order with nothing selected', () => {
    s().enter('notes', ORDER)
    expect(s().scope).toBe('notes')
    expect(s().order).toEqual(ORDER)
    expect(selected()).toEqual([])
  })

  it('toggle adds then removes an id', () => {
    s().enter('notes', ORDER)
    s().toggle('b')
    expect(selected()).toEqual(['b'])
    s().toggle('b')
    expect(selected()).toEqual([])
  })

  it('selectAll selects exactly the current order', () => {
    s().enter('canvas', ORDER)
    s().selectAll()
    expect(selected()).toEqual(ORDER)
  })

  it('clear empties the selection but stays in selection mode', () => {
    s().enter('notes', ORDER)
    s().selectAll()
    s().clear()
    expect(selected()).toEqual([])
    expect(s().scope).toBe('notes')
  })

  it('exit leaves selection mode and drops everything', () => {
    s().enter('notes', ORDER)
    s().toggle('a')
    s().exit()
    expect(s().scope).toBeNull()
    expect(selected()).toEqual([])
    expect(s().order).toEqual([])
  })

  describe('shift-range', () => {
    it('fills in forwards from the anchor', () => {
      s().enter('notes', ORDER)
      s().toggle('b')            // anchor
      s().toggle('d', true)
      expect(selected().sort()).toEqual(['b', 'c', 'd'])
    })

    it('fills in backwards from the anchor', () => {
      s().enter('notes', ORDER)
      s().toggle('d')
      s().toggle('b', true)
      expect(selected().sort()).toEqual(['b', 'c', 'd'])
    })

    it('keeps the anchor so the range can be re-stretched', () => {
      s().enter('notes', ORDER)
      s().toggle('b')
      s().toggle('d', true)
      expect(s().anchor).toBe('b')
      s().toggle('e', true)
      expect(selected().sort()).toEqual(['b', 'c', 'd', 'e'])
    })

    it('falls back to a plain toggle with no anchor', () => {
      s().enter('notes', ORDER)
      s().toggle('c', true)
      expect(selected()).toEqual(['c'])
    })

    it('ignores ids that are not in the order', () => {
      s().enter('notes', ORDER)
      s().toggle('b')
      s().toggle('zz', true)     // not listed — treated as a plain toggle
      expect(selected().sort()).toEqual(['b', 'zz'])
    })
  })

  describe('scope isolation', () => {
    it('entering another scope discards the previous selection', () => {
      s().enter('notes', ORDER)
      s().selectAll()
      s().enter('attachments', ['x', 'y'])
      expect(s().scope).toBe('attachments')
      expect(selected()).toEqual([])
    })

    it('exitSelection only fires for the scope that owns selection mode', () => {
      s().enter('notes', ORDER)
      exitSelection('canvas')
      expect(s().scope).toBe('notes')
      exitSelection('notes')
      expect(s().scope).toBeNull()
    })
  })
})
