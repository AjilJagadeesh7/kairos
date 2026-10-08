import { describe, expect, it } from 'vitest'
import { boardFactsHeader, computeBoardFacts, FACT_LIST_CAP } from './boardFacts'
import { boardListing } from './boardContext'
import { NOW, sprintBoard, task } from './__fixtures__/board'
import { doneColumnId, isTaskOverdue } from '../../utils/kanban'

describe('computeBoardFacts', () => {
  it('counts the fixture board exactly', () => {
    const f = computeBoardFacts(sprintBoard(), NOW)
    expect(f.today).toBe('2026-10-08')
    expect(f).toMatchObject({ totalIssues: 9, topLevelCards: 8, openIssues: 8, doneIssues: 1, highPriorityOpen: 2 })
    expect(f.columns).toEqual([
      { name: 'To Do', cards: 3, subIssues: 0, isDone: false },
      { name: 'In Progress', cards: 3, subIssues: 1, isDone: false, wipLimit: 2, overWipLimit: true },
      { name: 'Blocked', cards: 1, subIssues: 0, isDone: false },
      { name: 'Done', cards: 1, subIssues: 0, isDone: true },
    ])
    expect(f.overdue.count).toBe(2)
    expect(f.overdue.cards.map((c) => c.key)).toEqual(['KAI-5', 'KAI-1'])
    expect(f.dueSoon.cards.map((c) => [c.key, c.due])).toEqual([['KAI-4', '2026-10-09'], ['KAI-2', '2026-10-10']])
    expect(f.blocked.cards.map((c) => [c.key, c.why])).toEqual([['KAI-5', 'in "Blocked"'], ['KAI-6', 'tagged blocked']])
    expect(f.activeSprint).toEqual({ name: 'Sprint 14', issues: 5, done: 1, endDate: '2026-10-15' })
    expect(boardFactsHeader(f)).toBe('9 issues · 1 done · 2 overdue · 2 blocked')
  })

  it('matches the board UI helpers on every card (same overdue and done rules)', () => {
    const board = sprintBoard()
    const f = computeBoardFacts(board, new Date())
    const uiOverdue = board.tasks.filter((t) => isTaskOverdue(t, board)).length
    const uiDone = board.tasks.filter((t) => t.columnId === doneColumnId(board)).length
    expect(f.overdue.count).toBe(uiOverdue)
    expect(f.doneIssues).toBe(uiDone)
    expect(f.columns.reduce((n, c) => n + c.cards + c.subIssues, 0)).toBe(board.tasks.length)
  })

  it('caps long lists but keeps the true count', () => {
    const board = sprintBoard()
    for (let i = 0; i < 30; i++) {
      board.tasks.push(task({ key: `KAI-${100 + i}`, title: `Old ${i}`, columnId: 'c-todo', due: '2026-01-05T00:00:00.000Z' }))
    }
    const f = computeBoardFacts(board, NOW)
    expect(f.overdue.count).toBe(32)
    expect(f.overdue.cards).toHaveLength(FACT_LIST_CAP)
  })

  it('treats the last column as done when none is flagged', () => {
    const board = sprintBoard()
    board.columns = board.columns.map((c) => ({ ...c, isDone: undefined }))
    expect(computeBoardFacts(board, NOW).columns.at(-1)?.isDone).toBe(true)
  })
})

describe('boardListing', () => {
  it('lists every card in board order when it fits', () => {
    const l = boardListing(sprintBoard(), '', 4000)
    expect(l.omitted).toBe(0)
    expect(l.text).toContain('Columns, in order: To Do | In Progress | Blocked | Done (done column)')
    expect(l.text.indexOf('KAI-1 ')).toBeLessThan(l.text.indexOf('KAI-2 '))
    expect(l.text).toContain('- KAI-8 "Login form tests" [In Progress] type=subtask parent=KAI-1')
  })

  it('keeps the cards the message is about when the board does not fit', () => {
    const board = sprintBoard()
    for (let i = 0; i < 200; i++) board.tasks.push(task({ key: `KAI-${100 + i}`, title: `Filler card number ${i}`, columnId: 'c-todo' }))
    const l = boardListing(board, 'move the API cards and KAI-7 to done', 600)
    expect(l.omitted).toBeGreaterThan(0)
    expect(l.text).toContain('KAI-2 "API rate limiting"')
    expect(l.text).toContain('KAI-3 "API pagination"')
    expect(l.text).toContain('KAI-7 "Ship passkeys"')
    expect(l.text).toMatch(/\(\d+ more cards not listed here to save space\)/)
  })
})
