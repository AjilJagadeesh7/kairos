/**
 * Applies a confirmed plan to a board, and reverts it. Pure: both return a
 * new board, which the caller commits through the store as one write (one
 * undo step). New cards are built by the store's own `buildTask`, so keys and
 * order match a card added by hand.
 */
import { v4 as uuid } from 'uuid'
import { buildTask } from '../../store/kanban/taskActions'
import { nextTagColor } from '../../utils/kanban'
import type { BatchUndo, Board, CardPatch, KanbanTask, PlanAction } from '../../types'

function addMissingBoardTags(board: Board, tags: string[], added: string[]): Board {
  let b = board
  for (const name of tags) {
    if (b.boardTags.some((t) => t.name === name)) continue
    b = { ...b, boardTags: [...b.boardTags, { name, color: nextTagColor(b.boardTags) }] }
    added.push(name)
  }
  return b
}

function updateTask(board: Board, id: string, update: (t: KanbanTask) => KanbanTask): Board {
  return { ...board, tasks: board.tasks.map((t) => (t.id === id ? update(t) : t)) }
}

function nextOrder(board: Board, columnId: string): number {
  return board.tasks.filter((t) => t.columnId === columnId).reduce((m, t) => Math.max(m, t.order), 0) + 1
}

function pick(task: KanbanTask, patch: CardPatch): CardPatch {
  const before: CardPatch = {}
  for (const k of Object.keys(patch) as Array<keyof CardPatch>) (before as Record<string, unknown>)[k] = task[k]
  return before
}

export interface ApplyResult {
  board: Board
  undo: BatchUndo
  applied: number
  /** Actions that no longer fit the board (id → reason). */
  skipped: Record<string, string>
}

/**
 * Runs `actions` in order against the current board. Each one re-checks that
 * its card and column still exist, since the board may have changed after
 * the plan was made.
 */
export function applyPlan(board: Board, actions: PlanAction[], now = new Date()): ApplyResult {
  const undo: BatchUndo = { created: [], moved: [], updated: [], addedBoardTags: [] }
  const skipped: Record<string, string> = {}
  const stamp = now.toISOString()
  let b = board
  let applied = 0

  for (const action of actions) {
    const r = action.resolved
    if (!r) continue
    const columnId = r.tool === 'create_card' ? r.columnId : r.tool === 'move_card' ? r.toColumnId : null
    if (columnId && !b.columns.some((c) => c.id === columnId)) { skipped[action.id] = 'That column no longer exists'; continue }
    if (r.tool !== 'create_card' && !b.tasks.some((t) => t.id === r.taskId)) { skipped[action.id] = 'That card no longer exists'; continue }

    if (r.tool === 'create_card') {
      const id = uuid()
      const built = buildTask(b, id, r.columnId, r.title, stamp, {})
      b = updateTask(built.board, id, (t) => ({
        ...t, description: r.description, due: r.due, tags: r.tags, priority: r.priority,
      }))
      b = addMissingBoardTags(b, r.tags, undo.addedBoardTags)
      undo.created.push(id)
    } else if (r.tool === 'move_card') {
      const task = b.tasks.find((t) => t.id === r.taskId)!
      if (task.columnId === r.toColumnId) { skipped[action.id] = 'Already in that column'; continue }
      undo.moved.push({ taskId: task.id, fromColumnId: task.columnId, fromOrder: task.order, toColumnId: r.toColumnId })
      const order = nextOrder(b, r.toColumnId)
      b = updateTask(b, task.id, (t) => ({ ...t, columnId: r.toColumnId, order, updatedAt: stamp }))
    } else {
      const task = b.tasks.find((t) => t.id === r.taskId)!
      undo.updated.push({ taskId: task.id, before: pick(task, r.patch), after: r.patch })
      b = updateTask(b, task.id, (t) => ({ ...t, ...r.patch, updatedAt: stamp }))
      if (r.patch.tags) b = addMissingBoardTags(b, r.patch.tags, undo.addedBoardTags)
    }
    applied++
  }
  return { board: b, undo, applied, skipped }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/** A card the plan created that the user has since worked on (edited, commented, nested under). */
function touchedSince(t: KanbanTask, board: Board): boolean {
  return t.updatedAt !== t.createdAt || t.comments.length > 0 || t.attachments.length > 0
    || board.tasks.some((c) => c.parentId === t.id)
}

/**
 * Reverts an applied plan, newest change first. Only undoes what is still as
 * the plan left it: a field the user edited since keeps the user's value, and
 * a created card the user has worked on is kept (its key is in `kept`).
 */
export function revertPlan(board: Board, undo: BatchUndo, now = new Date()): { board: Board; kept: string[] } {
  const stamp = now.toISOString()
  let b = board

  for (const u of [...undo.updated].reverse()) {
    b = updateTask(b, u.taskId, (t) => {
      const restore: CardPatch = {}
      for (const k of Object.keys(u.after) as Array<keyof CardPatch>) {
        if (same(t[k], u.after[k])) (restore as Record<string, unknown>)[k] = u.before[k]
      }
      return Object.keys(restore).length ? { ...t, ...restore, updatedAt: stamp } : t
    })
  }
  for (const m of [...undo.moved].reverse()) {
    b = updateTask(b, m.taskId, (t) =>
      t.columnId === m.toColumnId ? { ...t, columnId: m.fromColumnId, order: m.fromOrder, updatedAt: stamp } : t)
  }
  const kept: string[] = []
  const gone = new Set<string>()
  for (const id of undo.created) {
    const t = b.tasks.find((x) => x.id === id)
    if (!t) continue
    if (touchedSince(t, b)) kept.push(t.key)
    else gone.add(id)
  }
  if (gone.size) {
    b = {
      ...b,
      tasks: b.tasks
        .filter((t) => !gone.has(t.id))
        .map((t) => (t.linkedTasks.some((id) => gone.has(id))
          ? { ...t, linkedTasks: t.linkedTasks.filter((id) => !gone.has(id)) }
          : t)),
    }
  }
  const stillUsed = new Set(b.tasks.flatMap((t) => t.tags))
  const dropTags = new Set(undo.addedBoardTags.filter((name) => !stillUsed.has(name)))
  if (dropTags.size) b = { ...b, boardTags: b.boardTags.filter((t) => !dropTags.has(t.name)) }
  return { board: b, kept }
}
