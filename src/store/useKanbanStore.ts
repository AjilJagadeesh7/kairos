import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import { duplicateBoardWithNewIds, nextTagColor, DEFAULT_COLUMN_COLORS } from '../utils/kanban'

async function fsUpsertBoard(board: Board): Promise<void> {
  const { writePlainBoard, isPlainFolderConnected } = await import('../sync/plainFolder')
  if (isPlainFolderConnected()) {
    writePlainBoard(board).catch(e => console.warn('[kanban] save failed:', e))
  }
}

async function fsDeleteBoard(id: string): Promise<void> {
  const { deletePlainBoard, isPlainFolderConnected } = await import('../sync/plainFolder')
  if (isPlainFolderConnected()) {
    deletePlainBoard(id).catch(e => console.warn('[kanban] delete failed:', e))
  }
}
import type {
  Board,
  KanbanColumn,
  KanbanTask,
  KanbanTag,
  KanbanFilters,
  Subtask,
  Checkpoint,
  Priority,
  TaskComment,
  TaskAttachment,
} from '../types/kanban.types'

export const DEFAULT_FILTERS: KanbanFilters = {
  tags: [],
  priorities: [],
  due: 'all',
  linkedNote: null,
  sort: 'manual',
}

interface BoardHistory {
  past: Board[]
  future: Board[]
}

interface KanbanState {
  boards: Board[]
  activeBoardId: string | null
  activeTaskId: string | null
  isLoaded: boolean
  filters: KanbanFilters
  history: Record<string, BoardHistory>

  loadBoards: () => Promise<void>
  setActiveBoardId: (id: string | null) => void
  setActiveTaskId: (id: string | null) => void

  createBoard: (title: string, description?: string) => string
  updateBoard: (boardId: string, updates: Partial<Pick<Board, 'title' | 'description'>>) => void
  deleteBoard: (boardId: string) => void
  duplicateBoard: (boardId: string) => string

  createColumn: (boardId: string, title: string, color: string) => void
  updateColumn: (boardId: string, columnId: string, updates: Partial<KanbanColumn>) => void
  deleteColumn: (boardId: string, columnId: string, moveTasksTo?: string) => void
  reorderColumns: (boardId: string, newOrderIds: string[]) => void

  createTask: (boardId: string, columnId: string, title: string) => string
  updateTask: (boardId: string, taskId: string, updates: Partial<KanbanTask>) => void
  deleteTask: (boardId: string, taskId: string) => void
  commitDragState: (boardId: string, tasks: KanbanTask[], columns?: KanbanColumn[]) => void

  addBoardTag: (boardId: string, name: string) => void
  updateBoardTag: (boardId: string, oldName: string, updates: Partial<KanbanTag>) => void
  deleteBoardTag: (boardId: string, name: string) => void

  createSubtask: (boardId: string, taskId: string, title: string) => void
  updateSubtask: (boardId: string, taskId: string, subtaskId: string, updates: Partial<Subtask>) => void
  deleteSubtask: (boardId: string, taskId: string, subtaskId: string) => void
  reorderSubtasks: (boardId: string, taskId: string, subtaskIds: string[]) => void

  createCheckpoint: (boardId: string, taskId: string, subtaskId: string, label: string) => void
  toggleCheckpoint: (boardId: string, taskId: string, subtaskId: string, checkpointId: string) => void
  deleteCheckpoint: (boardId: string, taskId: string, subtaskId: string, checkpointId: string) => void
  reorderCheckpoints: (boardId: string, taskId: string, subtaskId: string, checkpointIds: string[]) => void

  addComment: (boardId: string, taskId: string, content: string) => void
  deleteComment: (boardId: string, taskId: string, commentId: string) => void

  addAttachment: (boardId: string, taskId: string, attachment: TaskAttachment) => void
  deleteAttachment: (boardId: string, taskId: string, attachmentId: string) => void

  setFilters: (filters: Partial<KanbanFilters>) => void
  clearFilters: () => void

  undo: (boardId: string) => void
  redo: (boardId: string) => void
}

function normalizeBoard(board: Board): Board {
  return {
    ...board,
    tasks: board.tasks.map(t => ({
      ...t,
      comments: t.comments ?? [],
      attachments: t.attachments ?? [],
    })),
  }
}

function mutateBoard(
  get: () => KanbanState,
  set: (partial: Partial<KanbanState> | ((s: KanbanState) => Partial<KanbanState>)) => void,
  boardId: string,
  updater: (b: Board) => Board,
  recordHistory = true,
): void {
  const { boards, history } = get()
  const idx = boards.findIndex(b => b.id === boardId)
  if (idx === -1) return

  const oldBoard = boards[idx]
  const newBoard = { ...updater(oldBoard), updatedAt: new Date().toISOString() }
  const newBoards = boards.map((b, i) => (i === idx ? newBoard : b))

  let newHistory = history
  if (recordHistory) {
    const bh = history[boardId] ?? { past: [], future: [] }
    newHistory = {
      ...history,
      [boardId]: { past: [...bh.past.slice(-19), oldBoard], future: [] },
    }
  }

  set({ boards: newBoards, history: newHistory })
  void fsUpsertBoard(newBoard)
}

export const useKanbanStore = create<KanbanState>()(
  persist(
    (set, get) => ({
      boards: [],
      activeBoardId: null,
      activeTaskId: null,
      isLoaded: false,
      filters: DEFAULT_FILTERS,
      history: {},

      loadBoards: async () => {
        const { readAllBoards, isPlainFolderConnected } = await import('../sync/plainFolder')
        if (!isPlainFolderConnected()) {
          set({ isLoaded: true })
          return
        }
        try {
          const boards = await readAllBoards()
          const normalized = boards.map(normalizeBoard)
          normalized.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          set({ boards: normalized, isLoaded: true })
        } catch (err) {
          console.warn('[kanban] loadBoards failed:', err)
          set({ isLoaded: true })
        }
      },

      setActiveBoardId: (activeBoardId) => set({ activeBoardId }),
      setActiveTaskId: (activeTaskId) => set({ activeTaskId }),

      // ── Board ────────────────────────────────────────────────────────────
      createBoard: (title, description) => {
        const now = new Date().toISOString()
        const id = uuidv4()
        const columns: KanbanColumn[] = [
          { id: uuidv4(), title: 'Todo', color: DEFAULT_COLUMN_COLORS[0], order: 1 },
          { id: uuidv4(), title: 'In Progress', color: DEFAULT_COLUMN_COLORS[1], order: 2 },
          { id: uuidv4(), title: 'Review', color: DEFAULT_COLUMN_COLORS[2], order: 3 },
          { id: uuidv4(), title: 'Done', color: DEFAULT_COLUMN_COLORS[3], order: 4 },
        ]
        const board: Board = {
          id,
          title,
          description,
          createdAt: now,
          updatedAt: now,
          columns,
          tasks: [],
          boardTags: [],
        }
        set(s => ({ boards: [board, ...s.boards] }))
        void fsUpsertBoard(board)
        return id
      },

      updateBoard: (boardId, updates) => {
        mutateBoard(get, set, boardId, b => ({ ...b, ...updates }), false)
      },

      deleteBoard: (boardId) => {
        const { boards } = get()
        set(s => ({
          boards: s.boards.filter(b => b.id !== boardId),
          activeBoardId: s.activeBoardId === boardId ? null : s.activeBoardId,
          activeTaskId: s.activeBoardId === boardId ? null : s.activeTaskId,
        }))
        void fsDeleteBoard(boardId)
        const bh = { ...get().history }
        delete bh[boardId]
        set({ history: bh })
        // Also clear history for this board
        const { history } = get()
        const cleaned = { ...history }
        delete cleaned[boardId]
        set({ history: cleaned })
      },

      duplicateBoard: (boardId) => {
        const { boards } = get()
        const source = boards.find(b => b.id === boardId)
        if (!source) return ''
        const normalized = normalizeBoard(source)
        const copy = duplicateBoardWithNewIds(normalized, uuidv4)
        set(s => ({ boards: [copy, ...s.boards] }))
        void fsUpsertBoard(copy)
        return copy.id
      },

      // ── Columns ──────────────────────────────────────────────────────────
      createColumn: (boardId, title, color) => {
        mutateBoard(get, set, boardId, b => {
          const order = b.columns.length + 1
          return { ...b, columns: [...b.columns, { id: uuidv4(), title, color, order }] }
        })
      },

      updateColumn: (boardId, columnId, updates) => {
        mutateBoard(get, set, boardId, b => ({
          ...b,
          columns: b.columns.map(c => (c.id === columnId ? { ...c, ...updates } : c)),
        }), false)
      },

      deleteColumn: (boardId, columnId, moveTasksTo) => {
        mutateBoard(get, set, boardId, b => {
          const remaining = b.columns.filter(c => c.id !== columnId)
          let tasks = b.tasks
          if (moveTasksTo) {
            tasks = b.tasks.map(t => (t.columnId === columnId ? { ...t, columnId: moveTasksTo } : t))
          } else {
            tasks = b.tasks.filter(t => t.columnId !== columnId)
          }
          return { ...b, columns: remaining.map((c, i) => ({ ...c, order: i + 1 })), tasks }
        })
      },

      reorderColumns: (boardId, newOrderIds) => {
        mutateBoard(get, set, boardId, b => ({
          ...b,
          columns: newOrderIds
            .map(id => b.columns.find(c => c.id === id)!)
            .filter(Boolean)
            .map((c, i) => ({ ...c, order: i + 1 })),
        }), false)
      },

      // ── Tasks ─────────────────────────────────────────────────────────────
      createTask: (boardId, columnId, title) => {
        const id = uuidv4()
        const now = new Date().toISOString()
        mutateBoard(get, set, boardId, b => {
          const colTasks = b.tasks.filter(t => t.columnId === columnId)
          const task: KanbanTask = {
            id,
            title,
            columnId,
            order: colTasks.length + 1,
            priority: null,
            tags: [],
            linkedNotes: [],
            linkedTasks: [],
            subtasks: [],
            comments: [],
            attachments: [],
            createdAt: now,
            updatedAt: now,
          }
          return { ...b, tasks: [...b.tasks, task] }
        })
        return id
      },

      updateTask: (boardId, taskId, updates) => {
        mutateBoard(get, set, boardId, b => ({
          ...b,
          tasks: b.tasks.map(t =>
            t.id === taskId ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t,
          ),
        }), false)
      },

      deleteTask: (boardId, taskId) => {
        mutateBoard(get, set, boardId, b => {
          const task = b.tasks.find(t => t.id === taskId)
          if (!task) return b
          const remaining = b.tasks.filter(t => t.id !== taskId)
          const reordered = remaining.map(t => {
            if (t.columnId === task.columnId && t.order > task.order) {
              return { ...t, order: t.order - 1 }
            }
            return t
          })
          // Also remove from linkedTasks of other tasks
          const cleaned = reordered.map(t => ({
            ...t,
            linkedTasks: t.linkedTasks.filter(lt => lt !== taskId),
          }))
          return { ...b, tasks: cleaned }
        })
        set(s => ({
          activeTaskId: s.activeTaskId === taskId ? null : s.activeTaskId,
        }))
      },

      commitDragState: (boardId, tasks, columns) => {
        mutateBoard(get, set, boardId, b => ({
          ...b,
          tasks,
          columns: columns ?? b.columns,
        }), false)
      },

      // ── Board-level Tags ──────────────────────────────────────────────────
      addBoardTag: (boardId, name) => {
        mutateBoard(get, set, boardId, b => {
          if (b.boardTags.some(t => t.name === name)) return b
          const color = nextTagColor(b.boardTags)
          return { ...b, boardTags: [...b.boardTags, { name, color }] }
        }, false)
      },

      updateBoardTag: (boardId, oldName, updates) => {
        mutateBoard(get, set, boardId, b => {
          const newName = updates.name ?? oldName
          const boardTags = b.boardTags.map(t => (t.name === oldName ? { ...t, ...updates } : t))
          const tasks = newName !== oldName
            ? b.tasks.map(t => ({
                ...t,
                tags: t.tags.map(tag => (tag === oldName ? newName : tag)),
              }))
            : b.tasks
          return { ...b, boardTags, tasks }
        }, false)
      },

      deleteBoardTag: (boardId, name) => {
        mutateBoard(get, set, boardId, b => ({
          ...b,
          boardTags: b.boardTags.filter(t => t.name !== name),
          tasks: b.tasks.map(t => ({ ...t, tags: t.tags.filter(tag => tag !== name) })),
        }), false)
      },

      // ── Subtasks ──────────────────────────────────────────────────────────
      createSubtask: (boardId, taskId, title) => {
        mutateBoard(get, set, boardId, b => ({
          ...b,
          tasks: b.tasks.map(t => {
            if (t.id !== taskId) return t
            const sub: Subtask = {
              id: uuidv4(),
              title,
              done: false,
              order: t.subtasks.length + 1,
              checkpoints: [],
            }
            return { ...t, subtasks: [...t.subtasks, sub] }
          }),
        }), false)
      },

      updateSubtask: (boardId, taskId, subtaskId, updates) => {
        mutateBoard(get, set, boardId, b => ({
          ...b,
          tasks: b.tasks.map(t => {
            if (t.id !== taskId) return t
            return {
              ...t,
              subtasks: t.subtasks.map(s => (s.id === subtaskId ? { ...s, ...updates } : s)),
            }
          }),
        }), false)
      },

      deleteSubtask: (boardId, taskId, subtaskId) => {
        mutateBoard(get, set, boardId, b => ({
          ...b,
          tasks: b.tasks.map(t => {
            if (t.id !== taskId) return t
            return {
              ...t,
              subtasks: t.subtasks
                .filter(s => s.id !== subtaskId)
                .map((s, i) => ({ ...s, order: i + 1 })),
            }
          }),
        }), false)
      },

      reorderSubtasks: (boardId, taskId, subtaskIds) => {
        mutateBoard(get, set, boardId, b => ({
          ...b,
          tasks: b.tasks.map(t => {
            if (t.id !== taskId) return t
            const reordered = subtaskIds
              .map(id => t.subtasks.find(s => s.id === id)!)
              .filter(Boolean)
              .map((s, i) => ({ ...s, order: i + 1 }))
            return { ...t, subtasks: reordered }
          }),
        }), false)
      },

      // ── Checkpoints ───────────────────────────────────────────────────────
      createCheckpoint: (boardId, taskId, subtaskId, label) => {
        mutateBoard(get, set, boardId, b => ({
          ...b,
          tasks: b.tasks.map(t => {
            if (t.id !== taskId) return t
            return {
              ...t,
              subtasks: t.subtasks.map(s => {
                if (s.id !== subtaskId) return s
                const cp: Checkpoint = {
                  id: uuidv4(),
                  label,
                  done: false,
                  order: s.checkpoints.length + 1,
                }
                return { ...s, checkpoints: [...s.checkpoints, cp] }
              }),
            }
          }),
        }), false)
      },

      toggleCheckpoint: (boardId, taskId, subtaskId, checkpointId) => {
        mutateBoard(get, set, boardId, b => ({
          ...b,
          tasks: b.tasks.map(t => {
            if (t.id !== taskId) return t
            return {
              ...t,
              subtasks: t.subtasks.map(s => {
                if (s.id !== subtaskId) return s
                const checkpoints = s.checkpoints.map(c =>
                  c.id === checkpointId ? { ...c, done: !c.done } : c,
                )
                const allDone = checkpoints.length > 0 && checkpoints.every(c => c.done)
                return { ...s, checkpoints, done: allDone }
              }),
            }
          }),
        }), false)
      },

      deleteCheckpoint: (boardId, taskId, subtaskId, checkpointId) => {
        mutateBoard(get, set, boardId, b => ({
          ...b,
          tasks: b.tasks.map(t => {
            if (t.id !== taskId) return t
            return {
              ...t,
              subtasks: t.subtasks.map(s => {
                if (s.id !== subtaskId) return s
                return {
                  ...s,
                  checkpoints: s.checkpoints
                    .filter(c => c.id !== checkpointId)
                    .map((c, i) => ({ ...c, order: i + 1 })),
                }
              }),
            }
          }),
        }), false)
      },

      reorderCheckpoints: (boardId, taskId, subtaskId, checkpointIds) => {
        mutateBoard(get, set, boardId, b => ({
          ...b,
          tasks: b.tasks.map(t => {
            if (t.id !== taskId) return t
            return {
              ...t,
              subtasks: t.subtasks.map(s => {
                if (s.id !== subtaskId) return s
                const reordered = checkpointIds
                  .map(id => s.checkpoints.find(c => c.id === id)!)
                  .filter(Boolean)
                  .map((c, i) => ({ ...c, order: i + 1 }))
                return { ...s, checkpoints: reordered }
              }),
            }
          }),
        }), false)
      },

      // ── Comments & Attachments ───────────────────────────────────────────────
      addComment: (boardId, taskId, content) => {
        mutateBoard(get, set, boardId, b => ({
          ...b,
          tasks: b.tasks.map(t => {
            if (t.id !== taskId) return t
            const comment: TaskComment = {
              id: uuidv4(),
              content,
              createdAt: new Date().toISOString(),
            }
            return { ...t, comments: [...(t.comments ?? []), comment] }
          }),
        }), false)
      },

      deleteComment: (boardId, taskId, commentId) => {
        mutateBoard(get, set, boardId, b => ({
          ...b,
          tasks: b.tasks.map(t => {
            if (t.id !== taskId) return t
            return { ...t, comments: (t.comments ?? []).filter(c => c.id !== commentId) }
          }),
        }), false)
      },

      addAttachment: (boardId, taskId, attachment) => {
        mutateBoard(get, set, boardId, b => ({
          ...b,
          tasks: b.tasks.map(t => {
            if (t.id !== taskId) return t
            return { ...t, attachments: [...(t.attachments ?? []), attachment] }
          }),
        }), false)
      },

      deleteAttachment: (boardId, taskId, attachmentId) => {
        mutateBoard(get, set, boardId, b => ({
          ...b,
          tasks: b.tasks.map(t => {
            if (t.id !== taskId) return t
            return { ...t, attachments: (t.attachments ?? []).filter(a => a.id !== attachmentId) }
          }),
        }), false)
      },

      // ── Filters ───────────────────────────────────────────────────────────
      setFilters: (filters) => set(s => ({ filters: { ...s.filters, ...filters } })),
      clearFilters: () => set({ filters: DEFAULT_FILTERS }),

      // ── Undo / Redo ───────────────────────────────────────────────────────
      undo: (boardId) => {
        const { boards, history } = get()
        const bh = history[boardId]
        if (!bh || bh.past.length === 0) return
        const prev = bh.past[bh.past.length - 1]
        const current = boards.find(b => b.id === boardId)!
        const newHistory = {
          ...history,
          [boardId]: { past: bh.past.slice(0, -1), future: [current, ...bh.future] },
        }
        const newBoards = boards.map(b => (b.id === boardId ? prev : b))
        set({ boards: newBoards, history: newHistory })
        void fsUpsertBoard(prev)
      },

      redo: (boardId) => {
        const { boards, history } = get()
        const bh = history[boardId]
        if (!bh || bh.future.length === 0) return
        const next = bh.future[0]
        const current = boards.find(b => b.id === boardId)!
        const newHistory = {
          ...history,
          [boardId]: { past: [...bh.past, current], future: bh.future.slice(1) },
        }
        const newBoards = boards.map(b => (b.id === boardId ? next : b))
        set({ boards: newBoards, history: newHistory })
        void fsUpsertBoard(next)
      },
    }),
    {
      name: 'mindvault-kanban-ui',
      partialize: (state) => ({
        activeBoardId: state.activeBoardId,
        filters: state.filters,
      }),
    },
  ),
)
