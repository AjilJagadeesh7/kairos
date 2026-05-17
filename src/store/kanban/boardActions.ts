import { v4 as uuidv4 } from 'uuid'
import { duplicateBoardWithNewIds, DEFAULT_COLUMN_COLORS } from '../../utils/kanban'
import { mutateBoard, normalizeBoard, fsUpsertBoard, fsDeleteBoard, type SetFn, type GetFn } from './helpers'
import type { Board, KanbanColumn } from '../../types/kanban.types'

export function makeBoardActions(set: SetFn, get: GetFn) {
  return {
    createBoard: (title: string, description?: string): string => {
      const now = new Date().toISOString()
      const id = uuidv4()
      const columns: KanbanColumn[] = [
        { id: uuidv4(), title: 'Todo',        color: DEFAULT_COLUMN_COLORS[0], order: 1 },
        { id: uuidv4(), title: 'In Progress', color: DEFAULT_COLUMN_COLORS[1], order: 2 },
        { id: uuidv4(), title: 'Review',      color: DEFAULT_COLUMN_COLORS[2], order: 3 },
        { id: uuidv4(), title: 'Done',        color: DEFAULT_COLUMN_COLORS[3], order: 4 },
      ]
      const board: Board = { id, title, description, createdAt: now, updatedAt: now, columns, tasks: [], boardTags: [] }
      set(s => ({ boards: [board, ...s.boards] }))
      void fsUpsertBoard(board)
      return id
    },

    updateBoard: (boardId: string, updates: Partial<Pick<Board, 'title' | 'description'>>) => {
      mutateBoard(get, set, boardId, b => ({ ...b, ...updates }), false)
    },

    deleteBoard: (boardId: string) => {
      set(s => ({
        boards: s.boards.filter(b => b.id !== boardId),
        activeBoardId: s.activeBoardId === boardId ? null : s.activeBoardId,
        activeTaskId:  s.activeBoardId === boardId ? null : s.activeTaskId,
      }))
      void fsDeleteBoard(boardId)
      const { history } = get()
      const cleaned = { ...history }
      delete cleaned[boardId]
      set({ history: cleaned })
    },

    duplicateBoard: (boardId: string): string => {
      const { boards } = get()
      const source = boards.find(b => b.id === boardId)
      if (!source) return ''
      const copy = duplicateBoardWithNewIds(normalizeBoard(source), uuidv4)
      set(s => ({ boards: [copy, ...s.boards] }))
      void fsUpsertBoard(copy)
      return copy.id
    },

    // ── Columns ────────────────────────────────────────────────────────────
    createColumn: (boardId: string, title: string, color: string) => {
      mutateBoard(get, set, boardId, b => {
        const order = b.columns.length + 1
        return { ...b, columns: [...b.columns, { id: uuidv4(), title, color, order }] }
      })
    },

    updateColumn: (boardId: string, columnId: string, updates: Partial<KanbanColumn>) => {
      mutateBoard(get, set, boardId, b => ({
        ...b,
        columns: b.columns.map(c => (c.id === columnId ? { ...c, ...updates } : c)),
      }), false)
    },

    deleteColumn: (boardId: string, columnId: string, moveTasksTo?: string) => {
      mutateBoard(get, set, boardId, b => {
        const remaining = b.columns.filter(c => c.id !== columnId)
        const tasks = moveTasksTo
          ? b.tasks.map(t => (t.columnId === columnId ? { ...t, columnId: moveTasksTo } : t))
          : b.tasks.filter(t => t.columnId !== columnId)
        return { ...b, columns: remaining.map((c, i) => ({ ...c, order: i + 1 })), tasks }
      })
    },

    reorderColumns: (boardId: string, newOrderIds: string[]) => {
      mutateBoard(get, set, boardId, b => ({
        ...b,
        columns: newOrderIds
          .map(id => b.columns.find(c => c.id === id)!)
          .filter(Boolean)
          .map((c, i) => ({ ...c, order: i + 1 })),
      }), false)
    },
  }
}
