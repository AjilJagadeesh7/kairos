import { v4 as uuidv4 } from 'uuid'
import { mutateBoard, type SetFn, type GetFn } from './helpers'
import type { Sprint } from '../../types/kanban.types'

export function makeSprintActions(set: SetFn, get: GetFn) {
  return {
    createSprint: (boardId: string, name: string): string => {
      const id = uuidv4()
      mutateBoard(get, set, boardId, b => {
        const sprints = b.sprints ?? []
        const sprint: Sprint = { id, name, status: 'planned', order: sprints.length + 1 }
        return { ...b, sprints: [...sprints, sprint] }
      })
      return id
    },

    updateSprint: (boardId: string, sprintId: string, updates: Partial<Sprint>) => {
      mutateBoard(get, set, boardId, b => ({
        ...b,
        sprints: (b.sprints ?? []).map(s => (s.id === sprintId ? { ...s, ...updates } : s)),
      }), false)
    },

    deleteSprint: (boardId: string, sprintId: string) => {
      mutateBoard(get, set, boardId, b => ({
        ...b,
        // Return the sprint's issues to the backlog rather than deleting them.
        sprints: (b.sprints ?? []).filter(s => s.id !== sprintId).map((s, i) => ({ ...s, order: i + 1 })),
        tasks: b.tasks.map(t => (t.sprintId === sprintId ? { ...t, sprintId: null } : t)),
      }))
    },

    moveTaskToSprint: (boardId: string, taskId: string, sprintId: string | null) => {
      mutateBoard(get, set, boardId, b => ({
        ...b,
        tasks: b.tasks.map(t => (t.id === taskId ? { ...t, sprintId, updatedAt: new Date().toISOString() } : t)),
      }), false)
    },
  }
}
