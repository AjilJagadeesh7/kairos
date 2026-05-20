import { describe, it, expect, beforeEach, vi } from 'vitest'
import { makeFilterActions } from './filterActions'
import { DEFAULT_FILTERS } from './helpers'
import type { KanbanState } from './helpers'
import type { Board } from '../../types/kanban.types'

vi.mock('./helpers', async (importOriginal) => {
  const original = await importOriginal<typeof import('./helpers')>()
  return { ...original, fsUpsertBoard: vi.fn().mockResolvedValue(undefined) }
})

function makeBoard(id: string): Board {
  return { id, title: 'Board', columns: [], tasks: [], tags: [], createdAt: '', updatedAt: '' }
}

function makeState(overrides: Partial<KanbanState> = {}): KanbanState {
  return {
    boards: [],
    activeBoardId: null,
    activeTaskId: null,
    isLoaded: false,
    filters: { ...DEFAULT_FILTERS },
    history: {},
    ...overrides,
  } as KanbanState
}

function makeStore(initial: Partial<KanbanState> = {}) {
  let state = makeState(initial)
  const set = (partial: Partial<KanbanState> | ((s: KanbanState) => Partial<KanbanState>)) => {
    state = { ...state, ...(typeof partial === 'function' ? partial(state) : partial) }
  }
  const get = () => state
  return { actions: makeFilterActions(set, get), getState: get }
}

describe('setFilters', () => {
  it('merges partial filter updates', () => {
    const { actions, getState } = makeStore()
    actions.setFilters({ due: 'overdue' })
    expect(getState().filters.due).toBe('overdue')
    expect(getState().filters.sort).toBe(DEFAULT_FILTERS.sort)
  })

  it('can update multiple fields at once', () => {
    const { actions, getState } = makeStore()
    actions.setFilters({ due: 'today', sort: 'priority' })
    expect(getState().filters.due).toBe('today')
    expect(getState().filters.sort).toBe('priority')
  })
})

describe('clearFilters', () => {
  it('resets filters to defaults', () => {
    const { actions, getState } = makeStore()
    actions.setFilters({ due: 'overdue', sort: 'priority' })
    actions.clearFilters()
    expect(getState().filters).toEqual(DEFAULT_FILTERS)
  })
})

describe('undo / redo', () => {
  it('undo restores the previous board state', () => {
    const board = makeBoard('b1')
    const prevBoard = { ...board, title: 'Before' }
    const { actions, getState } = makeStore({
      boards: [board],
      history: { b1: { past: [prevBoard], future: [] } },
    })
    actions.undo('b1')
    expect(getState().boards[0].title).toBe('Before')
  })

  it('undo is a no-op when history is empty', () => {
    const board = makeBoard('b1')
    const { actions, getState } = makeStore({
      boards: [board],
      history: { b1: { past: [], future: [] } },
    })
    actions.undo('b1')
    expect(getState().boards[0].title).toBe('Board')
  })

  it('redo restores the future board state', () => {
    const board = makeBoard('b1')
    const futureBoard = { ...board, title: 'After' }
    const { actions, getState } = makeStore({
      boards: [board],
      history: { b1: { past: [], future: [futureBoard] } },
    })
    actions.redo('b1')
    expect(getState().boards[0].title).toBe('After')
  })

  it('undo pushes current board to future for redo', () => {
    const board = makeBoard('b1')
    const prevBoard = { ...board, title: 'Prev' }
    const { actions, getState } = makeStore({
      boards: [board],
      history: { b1: { past: [prevBoard], future: [] } },
    })
    actions.undo('b1')
    expect(getState().history['b1'].future[0].title).toBe('Board')
  })
})
