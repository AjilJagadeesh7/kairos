/**
 * Turns a confirmed task plan into create actions on the chosen board. Every
 * card links back to its source note; an item that is already a card on that
 * board (linked to this note, same title) is skipped, so running "Turn this
 * into tasks" twice doesn't duplicate cards.
 */
import { doneColumnId } from '../../utils/kanban'
import { normalizeForMatch } from './noteTasks'
import { dueDay } from './boardFacts'
import type { Board, KanbanColumn, KanbanTask, PlanAction, TaskPlan } from '../../types'

export interface TaskTarget { board: Board; column: KanbanColumn }

/** The first column that isn't the done column — where new work starts. */
export function defaultColumn(board: Board): KanbanColumn | undefined {
  const cols = [...board.columns].sort((a, b) => a.order - b.order)
  const done = doneColumnId(board)
  return cols.find((c) => c.id !== done) ?? cols[0]
}

/** The plan's own pick, else the last board used, else the first board. */
export function resolveTaskTarget(plan: TaskPlan, boards: Board[], remembered: { boardId: string; columnId: string } | null): TaskTarget | null {
  const board = boards.find((b) => b.id === plan.boardId)
    ?? boards.find((b) => b.id === remembered?.boardId)
    ?? boards[0]
  if (!board) return null
  const wanted = plan.boardId === board.id ? plan.columnId : remembered?.boardId === board.id ? remembered.columnId : null
  const column = board.columns.find((c) => c.id === wanted) ?? defaultColumn(board)
  return column ? { board, column } : null
}

/** A card on `board` already made from this item of this note. */
export function existingCard(board: Board, noteId: string, title: string): KanbanTask | undefined {
  const t = normalizeForMatch(title)
  return board.tasks.find((c) => c.linkedNotes.includes(noteId) && normalizeForMatch(c.title) === t)
}

/**
 * Plan rows for the card: one create action per task, resolved against `target`.
 * `checkExisting` is off after Apply, so created cards don't show as duplicates of themselves.
 */
export function taskActions(plan: TaskPlan, target: TaskTarget, checkExisting = true): PlanAction[] {
  return plan.tasks.map((task) => {
    const summary = `Add "${task.title}" to ${target.column.title}`
    // The source line gives the card its context; the model's title may be shorter.
    const description = task.origin === 'model' && task.quote !== task.title ? `From the note: “${task.quote}”` : undefined
    const changes = [
      ...(task.due ? [{ field: 'due' as const, before: '—', after: dueDay(task.due) ?? task.due }] : []),
      ...(task.priority ? [{ field: 'priority' as const, before: '—', after: task.priority }] : []),
      ...(description ? [{ field: 'description' as const, before: '—', after: description }] : []),
    ]
    const dupe = checkExisting ? existingCard(target.board, plan.noteId, task.title) : undefined
    const unresolved = task.unresolved ?? (dupe ? `Already on ${target.board.title} as ${dupe.key}` : undefined)
    return {
      id: task.id,
      tool: 'create_card',
      summary,
      changes,
      unresolved,
      resolved: unresolved ? null : {
        tool: 'create_card',
        columnId: target.column.id,
        title: task.title,
        description,
        due: task.due,
        tags: [],
        priority: task.priority,
        linkedNotes: [plan.noteId],
      },
    }
  })
}
