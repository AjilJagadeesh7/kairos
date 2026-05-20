import { describe, it, expect } from 'vitest'
import {
  SHORTCUT_REGISTRY,
  DEFAULT_SHORTCUTS,
  EXTRA_SHORTCUTS,
  normalizeEventKey,
  matchesBinding,
  bindingHasModifier,
  displayKey,
} from './registry'

describe('SHORTCUT_REGISTRY', () => {
  it('contains all default and extra shortcuts', () => {
    expect(SHORTCUT_REGISTRY.length).toBe(DEFAULT_SHORTCUTS.length + EXTRA_SHORTCUTS.length)
  })

  it('every entry has a unique id', () => {
    const ids = SHORTCUT_REGISTRY.map(s => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every default shortcut has a defaultKey', () => {
    for (const s of DEFAULT_SHORTCUTS) {
      expect(s.defaultKey).toBeTruthy()
    }
  })

  it('extra shortcuts have no defaultKey', () => {
    for (const s of EXTRA_SHORTCUTS) {
      expect(s.defaultKey).toBeUndefined()
    }
  })
})

describe('normalizeEventKey', () => {
  function fakeEvent(overrides: Partial<KeyboardEvent>): KeyboardEvent {
    return { ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, key: 'a', ...overrides } as KeyboardEvent
  }

  it('plain letter key', () => {
    expect(normalizeEventKey(fakeEvent({ key: 's' }))).toBe('s')
  })

  it('ctrl+s', () => {
    expect(normalizeEventKey(fakeEvent({ ctrlKey: true, key: 's' }))).toBe('ctrl+s')
  })

  it('ctrl+shift+z', () => {
    expect(normalizeEventKey(fakeEvent({ ctrlKey: true, shiftKey: true, key: 'z' }))).toBe('ctrl+shift+z')
  })

  it('metaKey is treated as ctrl', () => {
    expect(normalizeEventKey(fakeEvent({ metaKey: true, key: 's' }))).toBe('ctrl+s')
  })

  it('modifier-only keydown produces no trailing key', () => {
    expect(normalizeEventKey(fakeEvent({ ctrlKey: true, key: 'Control' }))).toBe('ctrl')
  })

  it('escape key', () => {
    expect(normalizeEventKey(fakeEvent({ key: 'Escape' }))).toBe('escape')
  })
})

describe('matchesBinding', () => {
  function fakeEvent(overrides: Partial<KeyboardEvent>): KeyboardEvent {
    return { ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, key: 'a', ...overrides } as KeyboardEvent
  }

  it('matches ctrl+s', () => {
    expect(matchesBinding(fakeEvent({ ctrlKey: true, key: 's' }), 'ctrl+s')).toBe(true)
  })

  it('does not match when modifier missing', () => {
    expect(matchesBinding(fakeEvent({ key: 's' }), 'ctrl+s')).toBe(false)
  })

  it('does not match wrong key', () => {
    expect(matchesBinding(fakeEvent({ ctrlKey: true, key: 'z' }), 'ctrl+s')).toBe(false)
  })

  it('matches escape', () => {
    expect(matchesBinding(fakeEvent({ key: 'Escape' }), 'escape')).toBe(true)
  })

  it('matches ctrl+shift+z', () => {
    expect(matchesBinding(fakeEvent({ ctrlKey: true, shiftKey: true, key: 'z' }), 'ctrl+shift+z')).toBe(true)
  })

  it('metaKey matches ctrl binding', () => {
    expect(matchesBinding(fakeEvent({ metaKey: true, key: 's' }), 'ctrl+s')).toBe(true)
  })
})

describe('bindingHasModifier', () => {
  it('ctrl+s has modifier', () => expect(bindingHasModifier('ctrl+s')).toBe(true))
  it('alt+f has modifier', () => expect(bindingHasModifier('alt+f')).toBe(true))
  it('plain escape has no modifier', () => expect(bindingHasModifier('escape')).toBe(false))
  it('shift alone is not a modifier in this context', () => expect(bindingHasModifier('shift+a')).toBe(false))
})

describe('displayKey', () => {
  it('ctrl+s → Ctrl+S', () => expect(displayKey('ctrl+s')).toBe('Ctrl+S'))
  it('ctrl+shift+z → Ctrl+Shift+Z', () => expect(displayKey('ctrl+shift+z')).toBe('Ctrl+Shift+Z'))
  it('escape → Esc', () => expect(displayKey('escape')).toBe('Esc'))
  it('/ stays as /', () => expect(displayKey('ctrl+/')).toBe('Ctrl+/'))
  it('arrowup → ↑', () => expect(displayKey('arrowup')).toBe('↑'))
})
