import { describe, expect, it } from 'vitest'
import { computePendingFacts, computeReviewFacts, periodStart, weekEnd } from './vaultFacts'
import { stampActivity } from '../../store/kanban/helpers'
import { NOW, sprintBoard } from './__fixtures__/board'
import { testVault } from './__fixtures__/vault'

describe('computePendingFacts', () => {
  it('counts what is pending across boards and notes exactly', () => {
    const f = computePendingFacts(testVault(), NOW)
    expect(f).toMatchObject({ today: '2026-10-08', weekEnd: '2026-10-11', openCards: 10 })
    expect(f.overdue.cards.map((c) => c.key)).toEqual(['KAI-5', 'KAI-1'])
    expect(f.dueThisWeek.cards.map((c) => c.key)).toEqual(['KAI-4', 'KAI-2', 'HOME-1'])
    expect(f.dueThisWeek.cards[2]).toMatchObject({ board: 'Home', boardId: 'b2', id: 't-HOME-1' })
    expect(f.notesWithOpenItems).toMatchObject({ count: 3, openItems: 4 })
    expect(f.notesWithOpenItems.notes[0]).toMatchObject({ id: 'n-standup', open: 2, items: ['Ask Dana about the API keys', "Review Kai's PR"] })
    expect(f.notesWithOpenItems.notes.map((n) => n.kind)).toContain('journal')
  })
})

describe('computeReviewFacts', () => {
  it('weekly review counts notes, journal and card activity since Monday', () => {
    const f = computeReviewFacts(testVault(), 'week', NOW)
    expect(f.since).toBe('2026-10-05')
    expect(f.notesCreated).toMatchObject({ count: 1, notes: [{ id: 'n-standup' }] })
    expect(f.notesEdited.count).toBe(2)
    expect(f.notesEdited.notes.map((n) => n.id).sort()).toEqual(['n-go', 'n-old'])
    expect(f.journalEntries.count).toBe(1)
    expect(f.cardsCreated.cards.map((c) => c.key)).toEqual(['KAI-3'])
    expect(f.cardsCompleted.cards.map((c) => c.key)).toEqual(['KAI-7'])
    expect(f.cardsMoved.cards.map((c) => c.key)).toEqual(['KAI-3', 'KAI-7'])
    expect(f.overdueNow).toBe(2)
  })

  it('daily review only counts today', () => {
    const f = computeReviewFacts(testVault(), 'day', NOW)
    expect(f).toMatchObject({ since: '2026-10-08', notesCreated: { count: 0 }, notesEdited: { count: 1 }, journalEntries: { count: 1 } })
    expect(f.cardsMoved.count).toBe(0)
  })

  it('period boundaries are local: Monday for weeks, the 1st for months', () => {
    expect(periodStart('week', NOW).getDay()).toBe(1)
    expect(periodStart('month', NOW).getDate()).toBe(1)
    expect(weekEnd(new Date(2026, 9, 11)).getDate()).toBe(11) // a Sunday is its own week end
  })
})

describe('stampActivity (kanban activity for reviews)', () => {
  const now = '2026-10-08T10:00:00.000Z'
  it('stamps movedAt on a column change and completedAt on entering done; leaving done clears it', () => {
    const before = sprintBoard()
    const moved = { ...before, tasks: before.tasks.map((t) => (t.key === 'KAI-2' ? { ...t, columnId: 'c-done' } : t.key === 'KAI-7' ? { ...t, columnId: 'c-todo', completedAt: '2026-09-15T00:00:00.000Z' } : t)) }
    const after = stampActivity(before, moved, now)
    const k = (key: string) => after.tasks.find((t) => t.key === key)!
    expect(k('KAI-2')).toMatchObject({ movedAt: now, completedAt: now })
    expect(k('KAI-7').movedAt).toBe(now)
    expect(k('KAI-7').completedAt).toBeUndefined()
    expect(k('KAI-3').movedAt).toBeUndefined()
  })
  it('returns the same board when no card changed column', () => {
    const b = sprintBoard()
    const edited = { ...b, tasks: b.tasks.map((t) => (t.key === 'KAI-1' ? { ...t, title: 'x' } : t)) }
    expect(stampActivity(b, edited, now)).toBe(edited)
  })
})
