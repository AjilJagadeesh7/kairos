import { v4 as uuidv4 } from 'uuid'
import { mutateBoard, type SetFn, type GetFn } from './helpers'
import type { KanbanTask, KanbanColumn } from '../../types/kanban.types'

export function makeTaskActions(set: SetFn, get: GetFn) {
  return {
    createTask: (boardId: string, columnId: string, title: string): string => {
      const id = uuidv4()
      const now = new Date().toISOString()
      mutateBoard(get, set, boardId, b => {
        const order = b.tasks.filter(t => t.columnId === columnId).length + 1
        const task: KanbanTask = {
          id, title, columnId, order,
          priority: null, tags: [], linkedNotes: [], linkedTasks: [],
          subtasks: [], comments: [], attachments: [],
          createdAt: now, updatedAt: now,
        }
        return { ...b, tasks: [...b.tasks, task] }
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
