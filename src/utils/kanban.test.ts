import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  isDueOverdue,
  isDueToday,
  isDueThisWeek,
  getDueState,
  nextTagColor,
  calcSubtaskProgress,
  calcTaskProgress,
  filterAndSortTasks,
  exportBoardToMarkdown,
  duplicateBoardWithNewIds,
  TAG_COLOR_PALETTE,
} from './kanban'
import type { Board, KanbanTask, KanbanColumn, KanbanFilters, KanbanTag, Subtask } from '../types/kanban.types'

const NOW = new Date('2026-05-20T12:00:00Z')

const day = (offset: number) => new Date(NOW.getTime() + offset * 86_400_000).toISOString()

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW) })
afterEach(() => { vi.useRealTimers() })

// --- Helpers ---

function makeTask(overrides: Partial<KanbanTask> = {}): KanbanTask {
  return {
    id: 'task-1', key: 'TSK-1', type: 'task', parentId: null, columnId: 'col-1', title: 'Task',
    order: 0, priority: null, tags: [], subtasks: [], linkedNotes: [], linkedTasks: [],
    comments: [], attachments: [], createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(),
    ...overrides,
  }
}

function makeSubtask(overrides: Partial<Subtask> = {}): Subtask {
  return { id: 's1', title: 'Sub', done: false, order: 0, checkpoints: [], ...overrides }
}

function makeBoard(overrides: Partial<Board> = {}): Board {
  return {
    id: 'board-1', title: 'My Board', columns: [], tasks: [], boardTags: [],
    createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(),
    ...overrides,
  }
}

function makeColumn(overrides: Partial<KanbanColumn> = {}): KanbanColumn {
  return { id: 'col-1', title: 'Todo', color: '#fff', order: 0, ...overrides }
}

const DEFAULT_FILTERS: KanbanFilters = {
  tags: [], priorities: [], types: [], due: 'all', linkedNote: null, query: '', sprint: null, sort: 'manual',
}

// --- Due date helpers ---

describe('isDueOverdue', () => {
  it('yesterday is overdue', () => expect(isDueOverdue(day(-1))).toBe(true))
  it('today is NOT overdue', () => expect(isDueOverdue(day(0))).toBe(false))
  it('tomorrow is not overdue', () => expect(isDueOverdue(day(1))).toBe(false))
})

describe('isDueToday', () => {
  it('today is today', () => expect(isDueToday(day(0))).toBe(true))
  it('yesterday is not today', () => expect(isDueToday(day(-1))).toBe(false))
  it('tomorrow is not today', () => expect(isDueToday(day(1))).toBe(false))
})

describe('isDueThisWeek', () => {
  it('3 days from now is this week', () => expect(isDueThisWeek(day(3))).toBe(true))
  it('today is this week', () => expect(isDueThisWeek(day(0))).toBe(true))
  it('8 days from now is NOT this week', () => expect(isDueThisWeek(day(8))).toBe(false))
  it('yesterday is not this week', () => expect(isDueThisWeek(day(-1))).toBe(false))
})

describe('getDueState', () => {
  it('no date → normal', () => expect(getDueState()).toBe('normal'))
  it('yesterday → overdue', () => expect(getDueState(day(-1))).toBe('overdue'))
  it('today → today', () => expect(getDueState(day(0))).toBe('today'))
  it('3 days away → soon', () => expect(getDueState(day(3))).toBe('soon'))
  it('10 days away → normal', () => expect(getDueState(day(10))).toBe('normal'))
})

// --- nextTagColor ---

describe('nextTagColor', () => {
  it('returns first palette color when no tags exist', () => {
    expect(nextTagColor([])).toBe(TAG_COLOR_PALETTE[0])
  })

  it('returns an unused color', () => {
    const used: KanbanTag[] = [{ name: 'a', color: TAG_COLOR_PALETTE[0] }]
    expect(nextTagColor(used)).toBe(TAG_COLOR_PALETTE[1])
  })

  it('wraps by index when all palette colors are used', () => {
    const allUsed: KanbanTag[] = TAG_COLOR_PALETTE.map((color, i) => ({ name: `t${i}`, color }))
    const extra: KanbanTag[] = [...allUsed, { name: 'extra', color: '#custom' }]
    // When all palette colors are taken, falls back to palette[length % palette.length]
    const result = nextTagColor(extra)
    expect(TAG_COLOR_PALETTE).toContain(result)
  })
})

// --- Progress ---

describe('calcSubtaskProgress', () => {
  it('done subtask → 1', () => {
    expect(calcSubtaskProgress(makeSubtask({ done: true }))).toBe(1)
  })

  it('no checkpoints and not done → 0', () => {
    expect(calcSubtaskProgress(makeSubtask())).toBe(0)
  })

  it('half checkpoints done → 0.5', () => {
    const sub = makeSubtask({
      checkpoints: [
        { id: 'c1', label: 'a', done: true, order: 0 },
        { id: 'c2', label: 'b', done: false, order: 1 },
      ],
    })
    expect(calcSubtaskProgress(sub)).toBe(0.5)
  })
})

describe('calcTaskProgress', () => {
  it('no subtasks → { done: 0, total: 0 }', () => {
    expect(calcTaskProgress(makeTask())).toEqual({ done: 0, total: 0 })
  })

  it('one done subtask out of two', () => {
    const task = makeTask({
      subtasks: [
        makeSubtask({ id: 's1', done: true }),
        makeSubtask({ id: 's2', done: false }),
      ],
    })
    expect(calcTaskProgress(task)).toEqual({ done: 1, total: 2 })
  })
})

// --- filterAndSortTasks ---

describe('filterAndSortTasks', () => {
  const tasks = [
    makeTask({ id: 't1', tags: ['react'], priority: 'high', order: 2, createdAt: '2026-01-01T00:00:00Z' }),
    makeTask({ id: 't2', tags: ['vue'],   priority: 'low',  order: 1, createdAt: '2026-01-02T00:00:00Z' }),
    makeTask({ id: 't3', tags: ['react'], priority: 'urgent', order: 0, createdAt: '2026-01-03T00:00:00Z' }),
  ]

  it('no filters returns all tasks', () => {
    expect(filterAndSortTasks(tasks, DEFAULT_FILTERS)).toHaveLength(3)
  })

  it('filters by tag', () => {
    const result = filterAndSortTasks(tasks, { ...DEFAULT_FILTERS, tags: ['react'] })
    expect(result.map(t => t.id)).toEqual(['t1', 't3'])
  })

  it('filters by priority', () => {
    const result = filterAndSortTasks(tasks, { ...DEFAULT_FILTERS, priorities: ['low'] })
    expect(result.map(t => t.id)).toEqual(['t2'])
  })

  it('sorts by priority (urgent first)', () => {
    const result = filterAndSortTasks(tasks, { ...DEFAULT_FILTERS, sort: 'priority' })
    expect(result[0].id).toBe('t3') // urgent
    expect(result[result.length - 1].id).toBe('t2') // low
  })

  it('sorts by created date ascending', () => {
    const result = filterAndSortTasks(tasks, { ...DEFAULT_FILTERS, sort: 'created' })
    expect(result[0].id).toBe('t1')
    expect(result[2].id).toBe('t3')
  })

  it('filters by due: overdue', () => {
    const withDue = [
      makeTask({ id: 'past', due: day(-2) }),
      makeTask({ id: 'future', due: day(3) }),
    ]
    const result = filterAndSortTasks(withDue, { ...DEFAULT_FILTERS, due: 'overdue' })
    expect(result.map(t => t.id)).toEqual(['past'])
  })
})

// --- exportBoardToMarkdown ---

describe('exportBoardToMarkdown', () => {
  it('includes board title', () => {
    const board = makeBoard({ title: 'Sprint 1' })
    expect(exportBoardToMarkdown(board)).toContain('# Sprint 1')
  })

  it('includes column headers', () => {
    const board = makeBoard({ columns: [makeColumn({ title: 'In Progress' })] })
    expect(exportBoardToMarkdown(board)).toContain('## In Progress')
  })

  it('includes task items', () => {
    const col = makeColumn({ id: 'c1' })
    const task = makeTask({ id: 't1', columnId: 'c1', title: 'Build tests', tags: ['ci'] })
    const board = makeBoard({ columns: [col], tasks: [task] })
    const md = exportBoardToMarkdown(board)
    expect(md).toContain('Build tests')
    expect(md).toContain('#ci')
  })
})

// --- duplicateBoardWithNewIds ---

describe('duplicateBoardWithNewIds', () => {
  let counter = 0
  const idFn = () => `new-id-${++counter}`

  beforeEach(() => { counter = 0 })

  it('prefixes title with "Copy of"', () => {
    const board = makeBoard({ title: 'Original' })
    expect(duplicateBoardWithNewIds(board, idFn).title).toBe('Copy of Original')
  })

  it('assigns a new board id', () => {
    const board = makeBoard({ id: 'old-board' })
    expect(duplicateBoardWithNewIds(board, idFn).id).not.toBe('old-board')
  })

  it('remaps column ids', () => {
    const col = makeColumn({ id: 'old-col' })
    const board = makeBoard({ columns: [col] })
    const dup = duplicateBoardWithNewIds(board, idFn)
    expect(dup.columns[0].id).not.toBe('old-col')
  })

  it('tasks reference new column ids', () => {
    const col = makeColumn({ id: 'old-col' })
    const task = makeTask({ columnId: 'old-col' })
    const board = makeBoard({ columns: [col], tasks: [task] })
    const dup = duplicateBoardWithNewIds(board, idFn)
    expect(dup.tasks[0].columnId).toBe(dup.columns[0].id)
  })
})
