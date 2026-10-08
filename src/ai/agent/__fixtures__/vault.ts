/** A small vault for the global-chat tests, around Thu 2026-10-08 10:00 local (NOW). */
import { sprintBoard, task } from './board'
import type { Board, JournalEntry, Note, VaultSnapshot } from '../../../types'

const local = (y: number, m: number, d: number, h = 9) => new Date(y, m - 1, d, h).toISOString()

export function note(id: string, title: string, content: string, created: string, updated = created, tags: string[] = []): Note {
  return { id, title, content, tags, embedding: [], createdAt: created, updatedAt: updated }
}

export function testVault(): VaultSnapshot {
  const notes: Note[] = [
    note('n-go', 'Go backend design', '## Storage\nWe use Postgres with pgx. Connection pool size is 20.\n\n## API\nREST with chi router.', local(2026, 9, 1), local(2026, 10, 6), ['backend']),
    note('n-standup', 'Standup notes', '- [ ] Ask Dana about the API keys\n- [ ] Review Kai\'s PR\n- [x] Fix flaky test', local(2026, 10, 7)),
    note('n-trip', 'Lisbon trip', 'Flights booked. Hotel near Alfama.\n- [ ] Buy travel insurance', local(2026, 9, 20), local(2026, 9, 21), ['travel']),
    note('n-old', 'Reading list', 'Thinking, Fast and Slow', local(2026, 8, 1), local(2026, 10, 8, 8)),
  ]
  const journal: JournalEntry[] = [
    { date: '2026-10-08', content: 'Shipped passkeys.\n- [ ] Write retro', updatedAt: local(2026, 10, 8) },
    { date: '2026-10-02', content: 'Quiet day.', updatedAt: local(2026, 10, 2) },
  ]
  const sprint = sprintBoard()
  // Activity this week on the sprint board.
  sprint.tasks = sprint.tasks.map((t) =>
    t.key === 'KAI-7' ? { ...t, completedAt: local(2026, 10, 6), movedAt: local(2026, 10, 6) }
    : t.key === 'KAI-3' ? { ...t, movedAt: local(2026, 10, 7), createdAt: local(2026, 10, 5, 12) }
    : t)
  const home: Board = {
    id: 'b2', title: 'Home', keyPrefix: 'HOME', seq: 2, createdAt: '', updatedAt: '', boardTags: [], sprints: [],
    columns: [
      { id: 'h-todo', title: 'Todo', color: '#888', order: 1 },
      { id: 'h-done', title: 'Done', color: '#888', order: 2, isDone: true },
    ],
    tasks: [
      task({ key: 'HOME-1', title: 'Renew car insurance', columnId: 'h-todo', due: '2026-10-11T00:00:00.000Z' }),
      task({ key: 'HOME-2', title: 'Book dentist', columnId: 'h-todo', due: '2026-10-20T00:00:00.000Z' }),
    ],
  }
  return { notes, journal, boards: [sprint, home] }
}
