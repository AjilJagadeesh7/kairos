/**
 * Facts about a board, computed in code so the model never counts. Uses the
 * same helpers as the board UI (done column, overdue), so the numbers match
 * the column headers and the Summary tab exactly.
 */
import { doneColumnId, isDueOverdue } from '../../utils/kanban'
import { isoDate } from '../text/relativeDates'
import type { Board, BoardFacts, FactCard, FactList, KanbanTask } from '../../types'

/** Lists in the facts are capped; `count` always carries the true size. */
export const FACT_LIST_CAP = 12

const BLOCKED_RE = /\bblock(?:ed|er|ing)?\b|\bon[ -]hold\b|\bwaiting\b/i

/** YYYY-MM-DD of a stored due date (stored as UTC midnight). */
export function dueDay(due: string | undefined): string | undefined {
  if (!due) return undefined
  return /^\d{4}-\d{2}-\d{2}/.test(due) ? due.slice(0, 10) : undefined
}

function factList(cards: FactCard[]): FactList {
  return { count: cards.length, cards: cards.slice(0, FACT_LIST_CAP) }
}

/**
 * Why a card counts as blocked: it sits in a column named like "Blocked" /
 * "On hold", or carries a tag like "blocked" / "blocker". Kairos has no
 * dedicated blocked flag, so this is the convention the facts follow.
 */
export function blockedReason(task: KanbanTask, columnTitle: string): string | null {
  if (BLOCKED_RE.test(columnTitle)) return `in "${columnTitle}"`
  const tag = task.tags.find((t) => BLOCKED_RE.test(t))
  return tag ? `tagged ${tag}` : null
}

export function computeBoardFacts(board: Board, now: Date): BoardFacts {
  const columns = [...board.columns].sort((a, b) => a.order - b.order)
  const colName = new Map(columns.map((c) => [c.id, c.title]))
  const doneId = doneColumnId(board)
  const isDone = (t: KanbanTask) => t.columnId === doneId
  const today = isoDate(now)
  const weekOut = isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7))
  const card = (t: KanbanTask, why?: string): FactCard => ({
    key: t.key, title: t.title, column: colName.get(t.columnId) ?? '?',
    ...(dueDay(t.due) ? { due: dueDay(t.due) } : {}), ...(why ? { why } : {}),
  })
  const byDue = (a: KanbanTask, b: KanbanTask) => (a.due ?? '').localeCompare(b.due ?? '')
  const open = board.tasks.filter((t) => !isDone(t))

  // Same rule as the board UI: past due date, not today, not in the done column.
  const overdue = open.filter((t) => t.due && isDueOverdue(t.due)).sort(byDue)
  const overdueIds = new Set(overdue.map((t) => t.id))
  const dueSoon = open
    .filter((t) => !overdueIds.has(t.id) && dueDay(t.due) && dueDay(t.due)! >= today && dueDay(t.due)! <= weekOut)
    .sort(byDue)
  const blocked = open.flatMap((t) => {
    const why = blockedReason(t, colName.get(t.columnId) ?? '')
    return why ? [card(t, why)] : []
  })

  const sprint = (board.sprints ?? []).find((s) => s.status === 'active')
  const sprintIssues = sprint ? board.tasks.filter((t) => t.sprintId === sprint.id) : []

  return {
    board: board.title,
    today,
    totalIssues: board.tasks.length,
    topLevelCards: board.tasks.filter((t) => !t.parentId).length,
    openIssues: open.length,
    doneIssues: board.tasks.length - open.length,
    columns: columns.map((c) => {
      const inCol = board.tasks.filter((t) => t.columnId === c.id)
      const cards = inCol.filter((t) => !t.parentId).length
      return {
        name: c.title,
        cards,
        subIssues: inCol.length - cards,
        isDone: c.id === doneId,
        ...(c.wipLimit ? { wipLimit: c.wipLimit, overWipLimit: cards > c.wipLimit } : {}),
      }
    }),
    overdue: factList(overdue.map((t) => card(t))),
    dueSoon: factList(dueSoon.map((t) => card(t))),
    blocked: factList(blocked),
    highPriorityOpen: open.filter((t) => t.priority === 'urgent' || t.priority === 'high').length,
    activeSprint: sprint
      ? {
          name: sprint.name,
          issues: sprintIssues.length,
          done: sprintIssues.filter(isDone).length,
          ...(sprint.endDate ? { endDate: sprint.endDate.slice(0, 10) } : {}),
        }
      : null,
  }
}

/** "14 issues · 3 overdue · 1 blocked" — the header above a board reply. */
export function boardFactsHeader(f: BoardFacts): string {
  const parts = [`${f.totalIssues} issue${f.totalIssues === 1 ? '' : 's'}`, `${f.doneIssues} done`]
  if (f.overdue.count) parts.push(`${f.overdue.count} overdue`)
  if (f.blocked.count) parts.push(`${f.blocked.count} blocked`)
  return parts.join(' · ')
}
