import { v4 as uuidv4 } from 'uuid'
import { mutateBoard, type SetFn, type GetFn } from './helpers'
import { deriveKeyPrefix, taskKey } from '../../utils/kanban'
import type { Board, KanbanTask, KanbanColumn, IssueType } from '../../types/kanban.types'

/** Builds a new task inside a board updater, allocating the next issue key. */
function buildTask(
  b: Board,
  id: string,
  columnId: string,
  title: string,
  now: string,
  extra: Partial<Pick<KanbanTask, 'type' | 'parentId' | 'sprintId'>>,
): { board: Board; task: KanbanTask } {
  const prefix = b.keyPrefix || deriveKeyPrefix(b.title)
  const seq = (b.seq ?? 0) + 1
  const order = b.tasks.filter(t => t.columnId === columnId).length + 1
  const task: KanbanTask = {
    id, key: taskKey(prefix, seq), type: extra.type ?? 'task',
    parentId: extra.parentId ?? null, title, columnId, order,
    priority: null, startDate: undefined, sprintId: extra.sprintId ?? null,
    tags: [], linkedNotes: [], linkedTasks: [],
    subtasks: [], comments: [], attachments: [],
    createdAt: now, updatedAt: now,
  }
  return { board: { ...b, keyPrefix: prefix, seq, tasks: [...b.tasks, task] }, task }
}

export function makeTaskActions(set: SetFn, get: GetFn) {
  return {
    createTask: (
      boardId: string, columnId: string, title: string,
      extra: Partial<Pick<KanbanTask, 'type' | 'parentId' | 'sprintId'>> = {},
    ): string => {
      const id = uuidv4()
      const now = new Date().toISOString()
      mutateBoard(get, set, boardId, b => buildTask(b, id, columnId, title, now, extra).board)
      return id
    },

    createChildIssue: (boardId: string, parentId: string, title: string, type: IssueType): string => {
      const id = uuidv4()
      const now = new Date().toISOString()
      mutateBoard(get, set, boardId, b => {
        const parent = b.tasks.find(t => t.id === parentId)
        const columnId = parent?.columnId ?? b.columns[0]?.id ?? ''
        return buildTask(b, id, columnId, title, now, { type, parentId, sprintId: parent?.sprintId ?? null }).board
      })
      return id
    },

    updateTask: (boardId: string, taskId: string, updates: Partial<KanbanTask>) => {
      mutateBoard(get, set, boardId, b => ({
        ...b,
        tasks: b.tasks.map(t =>
          t.id === taskId ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t,
        ),
      }), false)
    },

    deleteTask: (boardId: string, taskId: string) => {
      mutateBoard(get, set, boardId, b => {
        const task = b.tasks.find(t => t.id === taskId)
        if (!task) return b
        const remaining = b.tasks
          .filter(t => t.id !== taskId)
          .map(t => ({
            ...t,
            order: t.columnId === task.columnId && t.order > task.order ? t.order - 1 : t.order,
            linkedTasks: t.linkedTasks.filter(lt => lt !== taskId),
            // Orphan any children so their data survives the parent's deletion.
            parentId: t.parentId === taskId ? null : t.parentId,
          }))
        return { ...b, tasks: remaining }
      })
      set(s => ({ activeTaskId: s.activeTaskId === taskId ? null : s.activeTaskId }))
    },

    commitDragState: (boardId: string, tasks: KanbanTask[], columns?: KanbanColumn[]) => {
      mutateBoard(get, set, boardId, b => ({
        ...b,
        tasks,
        columns: columns ?? b.columns,
      }), false)
    },
  }
}
