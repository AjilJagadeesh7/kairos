import { useNavigate } from 'react-router-dom'
import { BookOpen, CalendarDays, Network, Settings2, SquareKanban } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { useKanbanStore } from '../store/useKanbanStore'
import { useJournalStore, todayDate } from '../store/useJournalStore'
import { timeAgo } from '../utils/timeAgo'
import { getDueState } from '../utils/kanban'

function greeting(name: string): string {
  const h = new Date().getHours()
  const base = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return name.trim() ? `${base}, ${name.trim().split(' ')[0]}` : 'MindVault'
}

export function LandingPage() {
  const navigate  = useNavigate()
  const notes     = useAppStore(s => s.notes)
  const boards    = useKanbanStore(s => s.boards)
  const userName  = useAppStore(s => s.userName)

  const dailyNotes  = useJournalStore(s => s.entries)
  const today       = todayDate()

  const recentNotes = [...notes]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 4)

  const recentBoards = [...boards]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 3)

  const recentDailyNotes = Object.values(dailyNotes)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3)

  return (
    <main className="flex-1 overflow-y-auto bg-[rgb(var(--bg))] px-6 py-8">
      <div className="mx-auto max-w-5xl">
        {/* Hero */}
        <div className="mb-10">
          <h1 className="text-3xl font-black tracking-tight text-[rgb(var(--text))]">
            {greeting(userName)}
          </h1>
          <p className="mt-1 text-[rgb(var(--text-2))]">
            {userName.trim()
              ? 'Your private, local-first knowledge base'
              : 'Private-by-default notes, kanban, and knowledge base'}
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Journal section */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays size={16} className="text-[rgb(var(--accent))]" />
                <h2 className="text-sm font-semibold text-[rgb(var(--text))]">Journal</h2>
                <span className="rounded-full bg-[rgb(var(--surface-2))] px-1.5 py-0.5 text-[10px] text-[rgb(var(--text-3))]">
                  {Object.keys(dailyNotes).length}
                </span>
              </div>
              <button
                onClick={() => navigate(`/journal/${today}`)}
                className="text-xs text-[rgb(var(--accent))] hover:underline"
              >
                Today →
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {/* Today's entry CTA */}
              <button
                onClick={() => navigate(`/journal/${today}`)}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition hover:shadow-sm ${
                  dailyNotes[today]
                    ? 'border-[rgb(var(--accent)/0.3)] bg-[rgb(var(--accent)/0.04)] hover:border-[rgb(var(--accent)/0.5)]'
                    : 'border-2 border-dashed border-[rgb(var(--border))] hover:border-[rgb(var(--accent))] hover:text-[rgb(var(--accent))]'
                }`}
              >
                <CalendarDays size={15} className="shrink-0 text-[rgb(var(--accent))]" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[rgb(var(--text))]">Today</p>
                  {dailyNotes[today] ? (
                    <p className="mt-0.5 line-clamp-1 text-xs text-[rgb(var(--text-3))]">
                      {dailyNotes[today].content.replace(/[#*`\[\]!]/g, '').trim().slice(0, 60) || 'Entry exists'}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-[rgb(var(--text-3))]">No entry yet — start writing</p>
                  )}
                </div>
              </button>

              {/* Recent past entries */}
              {recentDailyNotes.filter(n => n.date !== today).slice(0, 2).map(entry => {
                const [y, m, d] = entry.date.split('-').map(Number)
                const label = new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                return (
                  <button
                    key={entry.date}
                    onClick={() => navigate(`/journal/${entry.date}`)}
                    className="flex items-start gap-3 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-3 text-left transition hover:border-[rgb(var(--accent))] hover:shadow-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[rgb(var(--text))]">{label}</p>
                      {entry.content && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-[rgb(var(--text-3))]">
                          {entry.content.replace(/[#*`\[\]!]/g, '').trim().slice(0, 60)}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-[rgb(var(--text-3))]">{timeAgo(entry.updatedAt)}</span>
                  </button>
                )
              })}

              <button
                onClick={() => navigate('/journal')}
                className="rounded-xl border border-dashed border-[rgb(var(--border))] py-2 text-center text-xs text-[rgb(var(--text-3))] transition hover:border-[rgb(var(--accent))] hover:text-[rgb(var(--accent))]"
              >
                View calendar →
              </button>
            </div>
          </section>

          {/* Notes section */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen size={16} className="text-[rgb(var(--accent))]" />
                <h2 className="text-sm font-semibold text-[rgb(var(--text))]">Notes</h2>
                <span className="rounded-full bg-[rgb(var(--surface-2))] px-1.5 py-0.5 text-[10px] text-[rgb(var(--text-3))]">
                  {notes.length}
                </span>
              </div>
              <button
                onClick={() => navigate('/notes')}
                className="text-xs text-[rgb(var(--accent))] hover:underline"
              >
                View all →
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {recentNotes.length === 0 ? (
                <button
                  onClick={() => navigate('/notes')}
                  className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-[rgb(var(--border))] p-8 text-center text-[rgb(var(--text-3))] transition hover:border-[rgb(var(--accent))] hover:text-[rgb(var(--accent))]"
                >
                  <BookOpen size={20} />
                  <span className="text-sm">Start taking notes</span>
                </button>
              ) : (
                recentNotes.map(note => (
                  <button
                    key={note.id}
                    onClick={() => navigate(`/notes/${note.id}`)}
                    className="flex items-start gap-3 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-3 text-left transition hover:border-[rgb(var(--accent))] hover:shadow-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-[rgb(var(--text))]">
                        {note.title || 'Untitled note'}
                      </p>
                      {note.content && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-[rgb(var(--text-3))]">
                          {note.content.replace(/[#*`\[\]]/g, '').slice(0, 80)}
                        </p>
                      )}
                    </div>
                    <span className="flex-shrink-0 text-xs text-[rgb(var(--text-3))]">{timeAgo(note.updatedAt)}</span>
                  </button>
                ))
              )}
              {recentNotes.length > 0 && (
                <button
                  onClick={() => navigate('/notes')}
                  className="rounded-xl border border-dashed border-[rgb(var(--border))] py-2 text-center text-xs text-[rgb(var(--text-3))] transition hover:border-[rgb(var(--accent))] hover:text-[rgb(var(--accent))]"
                >
                  + New note
                </button>
              )}
            </div>
          </section>

          {/* Kanban section */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SquareKanban size={16} className="text-[rgb(var(--accent))]" />
                <h2 className="text-sm font-semibold text-[rgb(var(--text))]">Kanban</h2>
                <span className="rounded-full bg-[rgb(var(--surface-2))] px-1.5 py-0.5 text-[10px] text-[rgb(var(--text-3))]">
                  {boards.length}
                </span>
              </div>
              <button
                onClick={() => navigate('/kanban')}
                className="text-xs text-[rgb(var(--accent))] hover:underline"
              >
                View all →
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {recentBoards.length === 0 ? (
                <button
                  onClick={() => navigate('/kanban')}
                  className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-[rgb(var(--border))] p-8 text-center text-[rgb(var(--text-3))] transition hover:border-[rgb(var(--accent))] hover:text-[rgb(var(--accent))]"
                >
                  <SquareKanban size={20} />
                  <span className="text-sm">Create your first board</span>
                </button>
              ) : (
                recentBoards.map(board => {
                  const overdueCount = board.tasks.filter(t => {
                    if (!t.due || t.completedAt) return false
                    return getDueState(t.due) === 'overdue'
                  }).length
                  const inProgressCol = board.columns.find(c => c.title.toLowerCase().includes('progress'))
                  const inProgressCount = inProgressCol
                    ? board.tasks.filter(t => t.columnId === inProgressCol.id).length
                    : 0

                  return (
                    <button
                      key={board.id}
                      onClick={() => navigate(`/kanban/${board.id}`)}
                      className="flex items-start gap-3 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-3 text-left transition hover:border-[rgb(var(--accent))] hover:shadow-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-[rgb(var(--text))]">{board.title}</p>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-[rgb(var(--text-3))]">
                          <span>{board.tasks.length} tasks</span>
                          {inProgressCount > 0 && <span>· {inProgressCount} in progress</span>}
                          {overdueCount > 0 && <span className="text-red-500">· {overdueCount} overdue</span>}
                        </div>
                      </div>
                      <span className="flex-shrink-0 text-xs text-[rgb(var(--text-3))]">{timeAgo(board.updatedAt)}</span>
                    </button>
                  )
                })
              )}
              {recentBoards.length > 0 && (
                <button
                  onClick={() => navigate('/kanban')}
                  className="rounded-xl border border-dashed border-[rgb(var(--border))] py-2 text-center text-xs text-[rgb(var(--text-3))] transition hover:border-[rgb(var(--accent))] hover:text-[rgb(var(--accent))]"
                >
                  + New board
                </button>
              )}
            </div>
          </section>
        </div>

        {/* Quick links row */}
        <div className="mt-8 flex flex-wrap gap-3 border-t border-[rgb(var(--border))] pt-6">
          <button
            onClick={() => navigate(`/journal/${today}`)}
            className="flex items-center gap-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-4 py-2.5 text-sm text-[rgb(var(--text-2))] transition hover:border-[rgb(var(--accent))] hover:text-[rgb(var(--text))]"
          >
            <CalendarDays size={15} className="text-[rgb(var(--accent))]" /> Today's entry
          </button>
          <button
            onClick={() => navigate('/graph')}
            className="flex items-center gap-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-4 py-2.5 text-sm text-[rgb(var(--text-2))] transition hover:border-[rgb(var(--accent))] hover:text-[rgb(var(--text))]"
          >
            <Network size={15} className="text-[rgb(var(--accent))]" /> Graph view
          </button>
          <button
            onClick={() => navigate('/settings')}
            className="flex items-center gap-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-4 py-2.5 text-sm text-[rgb(var(--text-2))] transition hover:border-[rgb(var(--accent))] hover:text-[rgb(var(--text))]"
          >
            <Settings2 size={15} className="text-[rgb(var(--accent))]" /> Settings
          </button>
        </div>
      </div>
    </main>
  )
}
