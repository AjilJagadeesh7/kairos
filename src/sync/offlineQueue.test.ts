import { describe, it, expect, beforeEach, vi } from 'vitest'
import { enqueue, dequeue, getPending, clearQueue } from './offlineQueue'

const makeLocalStorage = () => {
  let store: Record<string, string> = {}
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { store = {} },
    _store: () => store,
  }
}

let ls: ReturnType<typeof makeLocalStorage>

beforeEach(() => {
  ls = makeLocalStorage()
  vi.stubGlobal('localStorage', ls)
})

describe('offlineQueue', () => {
  it('starts empty', () => {
    expect(getPending()).toEqual([])
  })

  it('enqueue adds a noteId', () => {
    enqueue('note-1')
    expect(getPending()).toContain('note-1')
  })

  it('enqueueing the same id twice deduplicates', () => {
    enqueue('note-1')
    enqueue('note-1')
    expect(getPending().filter(id => id === 'note-1')).toHaveLength(1)
  })

  it('enqueue multiple ids', () => {
    enqueue('a')
    enqueue('b')
    enqueue('c')
    expect(getPending()).toHaveLength(3)
  })

  it('dequeue removes a specific noteId', () => {
    enqueue('a')
    enqueue('b')
    dequeue('a')
    const pending = getPending()
    expect(pending).not.toContain('a')
    expect(pending).toContain('b')
  })

  it('dequeue on non-existent id is a no-op', () => {
    enqueue('a')
    dequeue('z')
    expect(getPending()).toContain('a')
  })

  it('clearQueue empties the queue', () => {
    enqueue('a')
    enqueue('b')
    clearQueue()
    expect(getPending()).toEqual([])
  })

  it('survives malformed localStorage JSON', () => {
    ls.setItem('mindvault_offline_queue', 'not-json')
    expect(getPending()).toEqual([])
    expect(() => enqueue('x')).not.toThrow()
  })
})
