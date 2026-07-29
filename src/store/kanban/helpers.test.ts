import { describe, it, expect, vi } from 'vitest'
import { normalizeBoard, mutateBoard, DEFAULT_FILTERS } from './helpers'
import type { Board, KanbanTask } from '../../types/kanban.types'
import type { KanbanState } from './helpers'

vi.mock('../../sync/plainFolder', () => ({
  isPlainFolderConnected: vi.fn().mockReturnValue(false),
  writePlainBoard: vi.fn().mockResolvedValue(undefined),
}))

function makeBoard(overrides: Partial<Board> = {}): Board {
  return { id: 'b1', title: 'Board', columns: [], tasks: [], boardTags: [], createdAt: '', updatedAt: '', ...overrides }
}

function makeTask(overrides: Partial<KanbanTask> = {}): KanbanTask {
  return {
    id: 't1', key: 'B-1', type: 'task', parentId: null, columnId: 'c1', title: 'Task',
    order: 0, priority: null, tags: [], subtasks: [], linkedNotes: [], linkedTasks: [],
    comments: [], attachments: [], createdAt: '', updatedAt: '', ...overrides,
  }
}

function makeKanbanState(overrides: Partial<KanbanState> = {}): KanbanState {
  return {
    boards: [],
    activeBoardId: null,
    activeTaskId: null,
    isLoaded: false,
    filters: { ...DEFAULT_FILTERS },
    groupBy: 'none',
    history: {},
    loadBoards:         vi.fn().mockResolvedValue(undefined),
    setActiveBoardId:   vi.fn(),
    setActiveTaskId:    vi.fn(),
    setGroupBy:         vi.fn(),
    createBoard:        vi.fn(),
    updateBoard:        vi.fn(),
    setBoardNoSync:     vi.fn(),
    deleteBoard:        vi.fn(),
    duplicateBoard:     vi.fn(),
    createColumn:       vi.fn(),
    updateColumn:       vi.fn(),
    deleteColumn:       vi.fn(),
    reorderColumns:     vi.fn(),
    createTask:         vi.fn(),
    createChildIssue:   vi.fn(),
    updateTask:         vi.fn(),
    deleteTask:         vi.fn(),
    commitDragState:    vi.fn(),
    createSprint:       vi.fn(),
    updateSprint:       vi.fn(),
    deleteSprint:       vi.fn(),
    moveTaskToSprint:   vi.fn(),
    addBoardTag:        vi.fn(),
    updateBoardTag:     vi.fn(),
    deleteBoardTag:     vi.fn(),
    createSubtask:      vi.fn(),
    updateSubtask:      vi.fn(),
    deleteSubtask:      vi.fn(),
    reorderSubtasks:    vi.fn(),
    createCheckpoint:   vi.fn(),
    toggleCheckpoint:   vi.fn(),
    deleteCheckpoint:   vi.fn(),
    reorderCheckpoints: vi.fn(),
    addComment:         vi.fn(),
    deleteComment:      vi.fn(),
    addAttachment:      vi.fn(),
    deleteAttachment:   vi.fn(),
    setFilters:         vi.fn(),
    clearFilters:       vi.fn(),
    undo:               vi.fn(),
    redo:               vi.fn(),
    ...overrides,
  }
}

describe('normalizeBoard', () => {
  it('fills missing comments and attachments with empty arrays', () => {
    const task = makeTask()
    // Simulate missing fields (as would come from old data)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (task as any).comments
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (task as any).attachments

    const board = makeBoard({ tasks: [task] })
    const normalized = normalizeBoard(board)
    expect(normalized.tasks[0].comments).toEqual([])
    expect(normalized.tasks[0].attachments).toEqual([])
  })

  it('preserves existing comments and attachments', () => {
    const task = makeTask({ comments: [{ id: 'c1', content: 'hi', createdAt: '' }], attachments: [] })
    const board = makeBoard({ tasks: [task] })
    const normalized = normalizeBoard(board)
    expect(normalized.tasks[0].comments).toHaveLength(1)
  })

  it('does not mutate the original board', () => {
    const task = makeTask()
    const board = makeBoard({ tasks: [task] })
    const normalized = normalizeBoard(board)
    expect(normalized).not.toBe(board)
  })
})

describe('mutateBoard', () => {
  it('calls updater with the current board and updates state', () => {
    const board = makeBoard({ title: 'Old' })
    let state = makeKanbanState({ boards: [board] })
    const set = (p: Partial<KanbanState> | ((s: KanbanState) => Partial<KanbanState>)) => {
      state = { ...state, ...(typeof p === 'function' ? p(state) : p) }
    }
    const get = () => state

    mutateBoard(get, set, 'b1', b => ({ ...b, title: 'New' }))
    expect(state.boards[0].title).toBe('New')
  })

  it('records the old board in history when recordHistory is true', () => {
    const board = makeBoard()
    let state = makeKanbanState({ boards: [board] })
    const set = (p: Partial<KanbanState> | ((s: KanbanState) => Partial<KanbanState>)) => {
      state = { ...state, ...(typeof p === 'function' ? p(state) : p) }
    }
    const get = () => state

    mutateBoard(get, set, 'b1', b => ({ ...b, title: 'Changed' }))
    expect(state.history['b1'].past).toHaveLength(1)
    expect(state.history['b1'].past[0].title).toBe('Board')
  })

  it('does not record history when recordHistory is false', () => {
    const board = makeBoard()
    let state = makeKanbanState({ boards: [board] })
    const set = (p: Partial<KanbanState> | ((s: KanbanState) => Partial<KanbanState>)) => {
      state = { ...state, ...(typeof p === 'function' ? p(state) : p) }
    }
    const get = () => state

    mutateBoard(get, set, 'b1', b => ({ ...b, title: 'Changed' }), false)
    expect(state.history['b1']).toBeUndefined()
  })

  it('is a no-op for a non-existent boardId', () => {
    const state = makeKanbanState({ boards: [] })
    const originalState = state
    const set = vi.fn()
    const get = () => state

    mutateBoard(get, set, 'missing-board', b => b)
    expect(set).not.toHaveBeenCalled()
    expect(state).toBe(originalState)
  })
})
