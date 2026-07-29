import { v4 as uuidv4 } from 'uuid'
import { deriveKeyPrefix, keySeq, taskKey } from '../../utils/kanban'
import type { Board, KanbanColumn, KanbanTask } from '../../types/kanban.types'

/**
 * Brings a persisted board up to the current schema:
 *  - derives a stable `keyPrefix` + `seq` counter and assigns human-readable
 *    issue keys (e.g. "KAI-42") to any task missing one
 *  - defaults `type` to 'task' and `parentId` to null
 *  - promotes legacy embedded `subtasks[]` into first-class child issues
 *    (type 'subtask', linked via `parentId`), preserving their checkpoints as
 *    the child's own lightweight checklist
 *  - marks a terminal "done" column and renumbers per-column ordering
 *
 * Deterministic: tasks are keyed in creation order so repeated loads (before any
 * mutation persists the result) produce identical keys.
 */
export function migrateBoard(board: Board): Board {
  const keyPrefix = board.keyPrefix || deriveKeyPrefix(board.title)

  // Ensure exactly one terminal "done" column (default: the last one).
  let columns: KanbanColumn[] = board.columns.map(c => ({ ...c }))
  if (columns.length > 0 && !columns.some(c => c.isDone)) {
    const sorted = [...columns].sort((a, b) => a.order - b.order)
    const lastId = sorted[sorted.length - 1].id
    columns = columns.map(c => (c.id === lastId ? { ...c, isDone: true } : c))
  }
  const doneId = columns.find(c => c.isDone)?.id ?? columns[0]?.id

  // Seed the key counter from the highest key already handed out.
  let seq = board.seq ?? 0
  for (const t of board.tasks) seq = Math.max(seq, keySeq(t.key))

  // Stable ordering → deterministic key assignment across reloads.
  const ordered = [...board.tasks].sort((a, b) => {
    const ac = new Date(a.createdAt).getTime()
    const bc = new Date(b.createdAt).getTime()
    if (ac !== bc) return ac - bc
    return (a.order ?? 0) - (b.order ?? 0)
  })

  const out: KanbanTask[] = []
  for (const raw of ordered) {
    const base: KanbanTask = {
      ...raw,
      type: raw.type ?? 'task',
      parentId: raw.parentId ?? null,
      key: raw.key || '',
      tags: raw.tags ?? [],
      linkedNotes: raw.linkedNotes ?? [],
      linkedTasks: raw.linkedTasks ?? [],
      subtasks: raw.subtasks ?? [],
      comments: raw.comments ?? [],
      attachments: raw.attachments ?? [],
      sprintId: raw.sprintId ?? null,
    }
    if (!base.key) base.key = taskKey(keyPrefix, ++seq)

    // Promote embedded subtasks into first-class children, then clear them.
    const embedded = base.subtasks
    base.subtasks = []
    out.push(base)

    for (const sub of [...embedded].sort((a, b) => a.order - b.order)) {
      const childDone = sub.done || (sub.checkpoints.length > 0 && sub.checkpoints.every(c => c.done))
      out.push({
        id: sub.id || uuidv4(),
        key: taskKey(keyPrefix, ++seq),
        type: 'subtask',
        parentId: base.id,
        title: sub.title,
        columnId: childDone && doneId ? doneId : base.columnId,
        order: sub.order,
        priority: null,
        tags: [],
        linkedNotes: [],
        linkedTasks: [],
        subtasks: sub.checkpoints.map((cp, i) => ({
          id: cp.id || uuidv4(), title: cp.label, done: cp.done, order: i + 1, checkpoints: [],
        })),
        comments: [],
        attachments: [],
        sprintId: base.sprintId ?? null,
        createdAt: base.createdAt,
        updatedAt: base.updatedAt,
        completedAt: childDone ? base.updatedAt : undefined,
      })
    }
  }

  // Renumber order within each column so drag/sort stays well-defined.
  const byCol = new Map<string, KanbanTask[]>()
  for (const t of out) {
    const arr = byCol.get(t.columnId) ?? []
    arr.push(t)
    byCol.set(t.columnId, arr)
  }
  byCol.forEach(arr => {
    arr.sort((a, b) => a.order - b.order).forEach((t, i) => { t.order = i + 1 })
  })

  return { ...board, keyPrefix, seq, sprints: board.sprints ?? [], columns, tasks: out }
}
