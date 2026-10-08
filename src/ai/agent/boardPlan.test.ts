import { describe, expect, it } from 'vitest'
import { MAX_PLAN_ACTIONS, parseDue, planFromToolCalls, resolveCard, resolveColumn } from './boardPlan'
import { applyPlan, revertPlan } from './boardApply'
import { NOW, sprintBoard } from './__fixtures__/board'
import type { Board, PlanAction, ToolCall } from '../../types'

const call = (name: string, args: Record<string, unknown>, i = 0): ToolCall => ({ id: `c${i}`, name, args })
const plan = (board: Board, ...calls: ToolCall[]) => planFromToolCalls(calls, board)!
const byKey = (b: Board, key: string) => b.tasks.find((t) => t.key === key)!

describe('resolving ids and columns', () => {
  const board = sprintBoard()
  it('resolves cards by key (any case), id, or a unique exact title', () => {
    expect(resolveCard(board, 'kai-3')).toEqual({ ok: byKey(board, 'KAI-3') })
    expect(resolveCard(board, 't-KAI-3')).toEqual({ ok: byKey(board, 'KAI-3') })
    expect(resolveCard(board, 'fix login bug')).toEqual({ ok: byKey(board, 'KAI-1') })
    expect(resolveCard(board, 'KAI-99')).toEqual({ error: expect.stringContaining('Could not resolve card') })
    expect(resolveCard(board, 'OTHER-1')).toHaveProperty('error')
  })
  it('matches columns case-insensitively, then ignoring spaces', () => {
    expect(resolveColumn(board, 'done')).toEqual({ ok: board.columns[3] })
    expect(resolveColumn(board, 'todo')).toEqual({ ok: board.columns[0] })
    expect(resolveColumn(board, 'Archive')).toEqual({ error: expect.stringContaining('columns: To Do, In Progress, Blocked, Done') })
  })
  it('accepts only real calendar dates', () => {
    expect(parseDue('2026-10-09')).toEqual({ ok: '2026-10-09T00:00:00.000Z' })
    expect(parseDue('2026-02-30')).toHaveProperty('error')
    expect(parseDue('tomorrow')).toHaveProperty('error')
  })
})

describe('planFromToolCalls', () => {
  it('builds summaries and field changes for valid actions', () => {
    const board = sprintBoard()
    const [create, move, update] = plan(board,
      call('create_card', { column: 'to do', title: 'Fix logout bug', due: '2026-10-09', tags: ['#Frontend', 'auth'], priority: 'high' }),
      call('move_card', { cardId: 'KAI-2', toColumn: 'Done' }),
      call('update_card', { cardId: 'KAI-3', due: '2026-10-12', addTags: ['urgent-fix'], removeTags: ['API'] }),
    )
    expect(create.summary).toBe('Add "Fix logout bug" to To Do')
    expect(create.resolved).toEqual({
      tool: 'create_card', columnId: 'c-todo', title: 'Fix logout bug', description: undefined,
      due: '2026-10-09T00:00:00.000Z', tags: ['frontend', 'auth'], priority: 'high',
    })
    expect(move.summary).toBe('Move KAI-2 "API rate limiting" → Done')
    expect(move.changes).toEqual([{ field: 'column', before: 'In Progress', after: 'Done' }])
    expect(update.summary).toBe('Update KAI-3 "API pagination": due, tags')
    expect(update.changes).toEqual([
      { field: 'due', before: '—', after: '2026-10-12' },
      { field: 'tags', before: 'api', after: 'urgent-fix' },
    ])
  })

  it('keeps unknown cards and columns as unresolved, never as executable', () => {
    const board = sprintBoard()
    const actions = plan(board,
      call('move_card', { cardId: 'KAI-42', toColumn: 'Done' }),
      call('move_card', { cardId: 'KAI-2', toColumn: 'Shipped' }),
      call('create_card', { column: 'Icebox', title: 'Someday' }),
      call('update_card', { cardId: 'KAI-1', due: 'next tuesday' }),
      call('move_card', { cardId: 'KAI-7', toColumn: 'done' }),
      call('update_card', { cardId: 'KAI-1', priority: 'urgent' }),
    )
    expect(actions.map((a) => a.resolved)).toEqual([null, null, null, null, null, null])
    expect(actions.map((a) => a.unresolved)).toEqual([
      expect.stringContaining('Could not resolve card "KAI-42"'),
      expect.stringContaining('No column named "Shipped"'),
      expect.stringContaining('No column named "Icebox"'),
      expect.stringContaining('not a YYYY-MM-DD date'),
      'Already in Done',
      'No change — the card already has these values',
    ])
  })

  it('refuses plans over the limit and duplicate changes to one card', () => {
    const board = sprintBoard()
    const many = Array.from({ length: MAX_PLAN_ACTIONS + 1 }, (_, i) => call('create_card', { column: 'To Do', title: `C${i}` }, i))
    expect(planFromToolCalls(many, board)).toBeNull()
    const [first, second] = plan(board, call('move_card', { cardId: 'KAI-2', toColumn: 'Done' }), call('move_card', { cardId: 'KAI-2', toColumn: 'Blocked' }))
    expect(first.resolved).not.toBeNull()
    expect(second.unresolved).toMatch(/already changes this card/)
  })
})

describe('applyPlan / revertPlan', () => {
  function applied(board: Board, actions: PlanAction[]) {
    return applyPlan(board, actions, NOW)
  }

  it('applies create, move and update as one new board and reverts all of it', () => {
    const board = sprintBoard()
    const actions = plan(board,
      call('create_card', { column: 'To Do', title: 'Fix logout bug', tags: ['auth'] }),
      call('move_card', { cardId: 'KAI-2', toColumn: 'Done' }),
      call('update_card', { cardId: 'KAI-3', title: 'API cursor pagination', priority: 'urgent' }),
    )
    const r = applied(board, actions)
    expect(r.applied).toBe(3)
    const created = r.board.tasks.find((t) => t.title === 'Fix logout bug')!
    expect(created).toMatchObject({ key: 'KAI-10', columnId: 'c-todo', tags: ['auth'], type: 'task' })
    expect(r.board.seq).toBe(10)
    expect(r.board.boardTags.map((t) => t.name)).toContain('auth')
    expect(byKey(r.board, 'KAI-2').columnId).toBe('c-done')
    expect(byKey(r.board, 'KAI-3')).toMatchObject({ title: 'API cursor pagination', priority: 'urgent' })
    expect(board.tasks).toHaveLength(9) // input untouched

    const { board: back, kept } = revertPlan(r.board, r.undo, NOW)
    expect(kept).toEqual([])
    expect(back.tasks.map((t) => [t.key, t.columnId, t.title, t.priority])).toEqual(
      board.tasks.map((t) => [t.key, t.columnId, t.title, t.priority]))
    expect(byKey(back, 'KAI-2').order).toBe(byKey(board, 'KAI-2').order)
    expect(back.boardTags).toEqual(board.boardTags)
  })

  it('skips actions whose card disappeared, and keeps user edits made after Apply on undo', () => {
    const board = sprintBoard()
    const actions = plan(board,
      call('create_card', { column: 'To Do', title: 'New card' }),
      call('update_card', { cardId: 'KAI-3', title: 'Renamed', priority: 'low' }),
      call('move_card', { cardId: 'KAI-4', toColumn: 'Done' }),
    )
    const gone = { ...board, tasks: board.tasks.filter((t) => t.key !== 'KAI-4') }
    const r = applied(gone, actions)
    expect(r.applied).toBe(2)
    expect(Object.values(r.skipped)).toEqual(['That card no longer exists'])

    // The user edits after Apply: renames KAI-3 again and comments on the new card.
    const edited: Board = {
      ...r.board,
      tasks: r.board.tasks.map((t) => (t.key === 'KAI-3' ? { ...t, title: 'User title' }
        : t.title === 'New card' ? { ...t, comments: [{ id: 'x', content: 'hi', createdAt: '' }] } : t)),
    }
    const { board: back, kept } = revertPlan(edited, r.undo, NOW)
    expect(byKey(back, 'KAI-3')).toMatchObject({ title: 'User title', priority: 'high' })
    expect(kept).toEqual(['KAI-10'])
    expect(back.tasks.some((t) => t.title === 'New card')).toBe(true)
  })
})
