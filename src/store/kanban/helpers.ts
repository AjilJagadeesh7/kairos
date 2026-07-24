import type { Board, KanbanColumn, KanbanTask, KanbanFilters, IssueType, Sprint, BoardGroupBy } from '../../types/kanban.types'
import { migrateBoard } from './migrate'

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
  groupBy: BoardGroupBy
  history: Record<string, BoardHistory>

  loadBoards: () => Promise<void>
  setGroupBy: (groupBy: BoardGroupBy) => void
  setActiveBoardId: (id: string | null) => void
  setActiveTaskId: (id: string | null) => void

  createBoard: (title: string, description?: string) => string
  updateBoard: (boardId: string, updates: Partial<Pick<Board, 'title' | 'description'>>) => void
  setBoardNoSync: (boardId: string, value: boolean) => void
  deleteBoard: (boardId: string) => void
  duplicateBoard: (boardId: string) => string

  createColumn: (boardId: string, title: string, color: string) => void
  updateColumn: (boardId: string, columnId: string, updates: Partial<KanbanColumn>) => void
  deleteColumn: (boardId: string, columnId: string, moveTasksTo?: string) => void
  reorderColumns: (boardId: string, newOrderIds: string[]) => void

  createTask: (boardId: string, columnId: string, title: string, extra?: Partial<Pick<KanbanTask, 'type' | 'parentId' | 'sprintId'>>) => string
  createChildIssue: (boardId: string, parentId: string, title: string, type: IssueType) => string
  updateTask: (boardId: string, taskId: string, updates: Partial<KanbanTask>) => void
  deleteTask: (boardId: string, taskId: string) => void
  commitDragState: (boardId: string, tasks: KanbanTask[], columns?: KanbanColumn[]) => void

  createSprint: (boardId: string, name: string) => string
  updateSprint: (boardId: string, sprintId: string, updates: Partial<Sprint>) => void
  deleteSprint: (boardId: string, sprintId: string) => void
  moveTaskToSprint: (boardId: string, taskId: string, sprintId: string | null) => void

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
  types: [],
  due: 'all',
  linkedNote: null,
  query: '',
  sprint: null,
  sort: 'manual',
}

/** Migrates a persisted board to the current schema (keys, issue types, child issues). */
export function normalizeBoard(board: Board): Board {
  return migrateBoard(board)
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
  const { schedulePush } = await import('../../sync/debouncedCloudPush')
  schedulePush('kanban', board.id, board)
}

export async function fsDeleteBoard(id: string): Promise<void> {
  const { deletePlainBoard, isPlainFolderConnected } = await import('../../sync/plainFolder')
  if (isPlainFolderConnected()) {
    deletePlainBoard(id).catch(e => console.warn('[kanban] delete failed:', e))
  }
  const { pushDelete } = await import('../../sync/debouncedCloudPush')
  pushDelete('kanban', id, `${id}.json`)
}
