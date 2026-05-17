import type { Board, KanbanColumn, KanbanTask, KanbanFilters } from '../../types/kanban.types'

export interface BoardHistory {
  past: Board[]
  future: Board[]
}

export interface KanbanState {
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
  updateBoardTag: (boardId: string, oldName: string, updates: Partial<import('../../types/kanban.types').KanbanTag>) => void
  deleteBoardTag: (boardId: string, name: string) => void

  createSubtask: (boardId: string, taskId: string, title: string) => void
  updateSubtask: (boardId: string, taskId: string, subtaskId: string, updates: Partial<import('../../types/kanban.types').Subtask>) => void
  deleteSubtask: (boardId: string, taskId: string, subtaskId: string) => void
  reorderSubtasks: (boardId: string, taskId: string, subtaskIds: string[]) => void

  createCheckpoint: (boardId: string, taskId: string, subtaskId: string, label: string) => void
  toggleCheckpoint: (boardId: string, taskId: string, subtaskId: string, checkpointId: string) => void
  deleteCheckpoint: (boardId: string, taskId: string, subtaskId: string, checkpointId: string) => void
  reorderCheckpoints: (boardId: string, taskId: string, subtaskId: string, checkpointIds: string[]) => void

  addComment: (boardId: string, taskId: string, content: string) => void
  deleteComment: (boardId: string, taskId: string, commentId: string) => void

  addAttachment: (boardId: string, taskId: string, attachment: import('../../types/kanban.types').TaskAttachment) => void
  deleteAttachment: (boardId: string, taskId: string, attachmentId: string) => void

  setFilters: (filters: Partial<KanbanFilters>) => void
  clearFilters: () => void

  undo: (boardId: string) => void
  redo: (boardId: string) => void
}

export type SetFn = (partial: Partial<KanbanState> | ((s: KanbanState) => Partial<KanbanState>)) => void
export type GetFn = () => KanbanState

export const DEFAULT_FILTERS: KanbanFilters = {
  tags: [],
  priorities: [],
  due: 'all',
  linkedNote: null,
  sort: 'manual',
}

export function normalizeBoard(board: Board): Board {
  return {
    ...board,
    tasks: board.tasks.map(t => ({
      ...t,
      comments:    t.comments    ?? [],
      attachments: t.attachments ?? [],
    })),
  }
}

export function mutateBoard(
  get: GetFn,
  set: SetFn,
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

export async function fsUpsertBoard(board: Board): Promise<void> {
  const { writePlainBoard, isPlainFolderConnected } = await import('../../sync/plainFolder')
  if (isPlainFolderConnected()) {
    writePlainBoard(board).catch(e => console.warn('[kanban] save failed:', e))
  }
}

export async function fsDeleteBoard(id: string): Promise<void> {
  const { deletePlainBoard, isPlainFolderConnected } = await import('../../sync/plainFolder')
  if (isPlainFolderConnected()) {
    deletePlainBoard(id).catch(e => console.warn('[kanban] delete failed:', e))
  }
}
