import { describe, it, expect, beforeEach } from 'vitest'
import { useConflictStore } from './useConflictStore'
import type { Conflict } from './useConflictStore'
import type { Note } from '../types'

const BLANK_NOTE: Note = { id: '', title: '', content: '', tags: [], embedding: [], createdAt: '', updatedAt: '' }

function makeConflict(noteId: string): Conflict {
  return {
    noteId,
    localNote:  { ...BLANK_NOTE, id: noteId },
    remoteNote: { ...BLANK_NOTE, id: noteId },
    detectedAt: new Date().toISOString(),
  }
}

beforeEach(() => {
  useConflictStore.setState({ conflicts: [] })
})

describe('useConflictStore — addConflict', () => {
  it('adds a conflict', () => {
    useConflictStore.getState().addConflict(makeConflict('n1'))
    expect(useConflictStore.getState().conflicts).toHaveLength(1)
  })

  it('replaces an existing conflict for the same noteId', () => {
    useConflictStore.getState().addConflict(makeConflict('n1'))
    useConflictStore.getState().addConflict(makeConflict('n1'))
    expect(useConflictStore.getState().conflicts).toHaveLength(1)
  })

  it('can hold conflicts for different notes', () => {
    useConflictStore.getState().addConflict(makeConflict('n1'))
    useConflictStore.getState().addConflict(makeConflict('n2'))
    expect(useConflictStore.getState().conflicts).toHaveLength(2)
  })
})

describe('useConflictStore — resolveConflict', () => {
  it('removes the conflict for the given noteId', () => {
    useConflictStore.getState().addConflict(makeConflict('n1'))
    useConflictStore.getState().resolveConflict('n1')
    expect(useConflictStore.getState().conflicts).toHaveLength(0)
  })

  it('only removes the matching conflict', () => {
    useConflictStore.getState().addConflict(makeConflict('n1'))
    useConflictStore.getState().addConflict(makeConflict('n2'))
    useConflictStore.getState().resolveConflict('n1')
    expect(useConflictStore.getState().conflicts.map(c => c.noteId)).toEqual(['n2'])
  })

  it('is a no-op if noteId has no conflict', () => {
    useConflictStore.getState().addConflict(makeConflict('n1'))
    useConflictStore.getState().resolveConflict('does-not-exist')
    expect(useConflictStore.getState().conflicts).toHaveLength(1)
  })
})
