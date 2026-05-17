import { v4 as uuidv4 } from 'uuid'
import { nextTagColor } from '../../utils/kanban'
import { mutateBoard, type SetFn, type GetFn } from './helpers'
import type { KanbanTag, Subtask, Checkpoint, TaskComment, TaskAttachment } from '../../types/kanban.types'

export function makeMetaActions(set: SetFn, get: GetFn) {
  return {
    // ── Board-level Tags ────────────────────────────────────────────────
    addBoardTag: (boardId: string, name: string) => {
      mutateBoard(get, set, boardId, b => {
        if (b.boardTags.some(t => t.name === name)) return b
        return { ...b, boardTags: [...b.boardTags, { name, color: nextTagColor(b.boardTags) }] }
      }, false)
    },

    updateBoardTag: (boardId: string, oldName: string, updates: Partial<KanbanTag>) => {
      mutateBoard(get, set, boardId, b => {
        const newName = updates.name ?? oldName
        const boardTags = b.boardTags.map(t => (t.name === oldName ? { ...t, ...updates } : t))
        const tasks = newName !== oldName
          ? b.tasks.map(t => ({ ...t, tags: t.tags.map(tag => (tag === oldName ? newName : tag)) }))
          : b.tasks
        return { ...b, boardTags, tasks }
      }, false)
    },

    deleteBoardTag: (boardId: string, name: string) => {
      mutateBoard(get, set, boardId, b => ({
        ...b,
        boardTags: b.boardTags.filter(t => t.name !== name),
        tasks: b.tasks.map(t => ({ ...t, tags: t.tags.filter(tag => tag !== name) })),
      }), false)
    },

    // ── Subtasks ────────────────────────────────────────────────────────
    createSubtask: (boardId: string, taskId: string, title: string) => {
      mutateBoard(get, set, boardId, b => ({
        ...b,
        tasks: b.tasks.map(t => {
          if (t.id !== taskId) return t
          const sub: Subtask = { id: uuidv4(), title, done: false, order: t.subtasks.length + 1, checkpoints: [] }
          return { ...t, subtasks: [...t.subtasks, sub] }
        }),
      }), false)
    },

    updateSubtask: (boardId: string, taskId: string, subtaskId: string, updates: Partial<Subtask>) => {
      mutateBoard(get, set, boardId, b => ({
        ...b,
        tasks: b.tasks.map(t => t.id !== taskId ? t : {
          ...t,
          subtasks: t.subtasks.map(s => (s.id === subtaskId ? { ...s, ...updates } : s)),
        }),
      }), false)
    },

    deleteSubtask: (boardId: string, taskId: string, subtaskId: string) => {
      mutateBoard(get, set, boardId, b => ({
        ...b,
        tasks: b.tasks.map(t => t.id !== taskId ? t : {
          ...t,
          subtasks: t.subtasks.filter(s => s.id !== subtaskId).map((s, i) => ({ ...s, order: i + 1 })),
        }),
      }), false)
    },

    reorderSubtasks: (boardId: string, taskId: string, subtaskIds: string[]) => {
      mutateBoard(get, set, boardId, b => ({
        ...b,
        tasks: b.tasks.map(t => t.id !== taskId ? t : {
          ...t,
          subtasks: subtaskIds
            .map(id => t.subtasks.find(s => s.id === id)!)
            .filter(Boolean)
            .map((s, i) => ({ ...s, order: i + 1 })),
        }),
      }), false)
    },

    // ── Checkpoints ─────────────────────────────────────────────────────
    createCheckpoint: (boardId: string, taskId: string, subtaskId: string, label: string) => {
      mutateBoard(get, set, boardId, b => ({
        ...b,
        tasks: b.tasks.map(t => t.id !== taskId ? t : {
          ...t,
          subtasks: t.subtasks.map(s => {
            if (s.id !== subtaskId) return s
            const cp: Checkpoint = { id: uuidv4(), label, done: false, order: s.checkpoints.length + 1 }
            return { ...s, checkpoints: [...s.checkpoints, cp] }
          }),
        }),
      }), false)
    },

    toggleCheckpoint: (boardId: string, taskId: string, subtaskId: string, checkpointId: string) => {
      mutateBoard(get, set, boardId, b => ({
        ...b,
        tasks: b.tasks.map(t => t.id !== taskId ? t : {
          ...t,
          subtasks: t.subtasks.map(s => {
            if (s.id !== subtaskId) return s
            const checkpoints = s.checkpoints.map(c => c.id === checkpointId ? { ...c, done: !c.done } : c)
            return { ...s, checkpoints, done: checkpoints.length > 0 && checkpoints.every(c => c.done) }
          }),
        }),
      }), false)
    },

    deleteCheckpoint: (boardId: string, taskId: string, subtaskId: string, checkpointId: string) => {
      mutateBoard(get, set, boardId, b => ({
        ...b,
        tasks: b.tasks.map(t => t.id !== taskId ? t : {
          ...t,
          subtasks: t.subtasks.map(s => s.id !== subtaskId ? s : {
            ...s,
            checkpoints: s.checkpoints.filter(c => c.id !== checkpointId).map((c, i) => ({ ...c, order: i + 1 })),
          }),
        }),
      }), false)
    },

    reorderCheckpoints: (boardId: string, taskId: string, subtaskId: string, checkpointIds: string[]) => {
      mutateBoard(get, set, boardId, b => ({
        ...b,
        tasks: b.tasks.map(t => t.id !== taskId ? t : {
          ...t,
          subtasks: t.subtasks.map(s => s.id !== subtaskId ? s : {
            ...s,
            checkpoints: checkpointIds
              .map(id => s.checkpoints.find(c => c.id === id)!)
              .filter(Boolean)
              .map((c, i) => ({ ...c, order: i + 1 })),
          }),
        }),
      }), false)
    },

    // ── Comments & Attachments ──────────────────────────────────────────
    addComment: (boardId: string, taskId: string, content: string) => {
      mutateBoard(get, set, boardId, b => ({
        ...b,
        tasks: b.tasks.map(t => t.id !== taskId ? t : {
          ...t,
          comments: [...(t.comments ?? []), { id: uuidv4(), content, createdAt: new Date().toISOString() } as TaskComment],
        }),
      }), false)
    },

    deleteComment: (boardId: string, taskId: string, commentId: string) => {
      mutateBoard(get, set, boardId, b => ({
        ...b,
        tasks: b.tasks.map(t => t.id !== taskId ? t : {
          ...t,
          comments: (t.comments ?? []).filter(c => c.id !== commentId),
        }),
      }), false)
    },

    addAttachment: (boardId: string, taskId: string, attachment: TaskAttachment) => {
      mutateBoard(get, set, boardId, b => ({
        ...b,
        tasks: b.tasks.map(t => t.id !== taskId ? t : {
          ...t,
          attachments: [...(t.attachments ?? []), attachment],
        }),
      }), false)
    },

    deleteAttachment: (boardId: string, taskId: string, attachmentId: string) => {
      mutateBoard(get, set, boardId, b => ({
        ...b,
        tasks: b.tasks.map(t => t.id !== taskId ? t : {
          ...t,
          attachments: (t.attachments ?? []).filter(a => a.id !== attachmentId),
        }),
      }), false)
    },
  }
}
