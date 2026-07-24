import { describe, it, expect } from 'vitest'
import { migrateBoard } from './migrate'
import type { Board, KanbanColumn, KanbanTask, Subtask } from '../../types/kanban.types'

function col(id: string, order: number, extra: Partial<KanbanColumn> = {}): KanbanColumn {
  return { id, title: id, color: '#fff', order, ...extra }
}

function task(overrides: Partial<KanbanTask> = {}): KanbanTask {
  return {
    id: 't1', key: '', type: 'task', columnId: 'todo', title: 'Task',
    order: 1, priority: null, tags: [], linkedNotes: [], linkedTasks: [],
    subtasks: [], comments: [], attachments: [],
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  } as KanbanTask
}

function board(overrides: Partial<Board> = {}): Board {
  return {
    id: 'b1', title: 'My Board', createdAt: '', updatedAt: '',
    columns: [col('todo', 1), col('done', 2)], tasks: [], boardTags: [],
    ...overrides,
  }
}

const sub = (o: Partial<Subtask> = {}): Subtask => ({ id: 's1', title: 'Sub', done: false, order: 1, checkpoints: [], ...o })

describe('migrateBoard', () => {
  it('derives a key prefix from the board title', () => {
    expect(migrateBoard(board({ title: 'Kairos App' })).keyPrefix).toBe('KA')
    expect(migrateBoard(board({ title: 'Brew' })).keyPrefix).toBe('BREW')
  })

  it('assigns sequential keys to tasks missing one', () => {
    const out = migrateBoard(board({
      title: 'Team', tasks: [task({ id: 'a' }), task({ id: 'b', createdAt: '2026-01-02T00:00:00Z' })],
    }))
    const keys = out.tasks.map(t => t.key)
    expect(keys).toContain('TEAM-1')
    expect(keys).toContain('TEAM-2')
  })

  it('preserves existing keys and seeds seq from the highest', () => {
    const out = migrateBoard(board({
      title: 'Team',
      tasks: [task({ id: 'a', key: 'TEAM-9' }), task({ id: 'b' })],
    }))
    expect(out.tasks.find(t => t.id === 'a')!.key).toBe('TEAM-9')
    expect(out.seq).toBeGreaterThanOrEqual(10)
  })

  it('marks the last column as done when none flagged', () => {
    const out = migrateBoard(board())
    expect(out.columns.find(c => c.id === 'done')!.isDone).toBe(true)
    expect(out.columns.find(c => c.id === 'todo')!.isDone).toBeFalsy()
  })

  it('promotes embedded subtasks into first-class child issues', () => {
    const out = migrateBoard(board({
      tasks: [task({ id: 'parent', subtasks: [sub({ id: 'x', title: 'child' })] })],
    }))
    expect(out.tasks).toHaveLength(2)
    const child = out.tasks.find(t => t.id === 'x')!
    expect(child.type).toBe('subtask')
    expect(child.parentId).toBe('parent')
    expect(child.key).toMatch(/-\d+$/)
    // Parent's embedded list is cleared after promotion.
    expect(out.tasks.find(t => t.id === 'parent')!.subtasks).toHaveLength(0)
  })

  it('routes done subtasks into the done column and preserves checkpoints', () => {
    const out = migrateBoard(board({
      tasks: [task({
        id: 'parent',
        subtasks: [sub({ id: 'x', done: true, checkpoints: [{ id: 'c1', label: 'cp', done: true, order: 1 }] })],
      })],
    }))
    const child = out.tasks.find(t => t.id === 'x')!
    expect(child.columnId).toBe('done')
    expect(child.subtasks[0].title).toBe('cp')
  })

  it('is deterministic across repeated runs', () => {
    const src = board({ title: 'Team', tasks: [task({ id: 'a' }), task({ id: 'b', createdAt: '2026-01-02T00:00:00Z' })] })
    const a = migrateBoard(src)
    const b = migrateBoard(src)
    expect(a.tasks.map(t => t.key)).toEqual(b.tasks.map(t => t.key))
  })
})
