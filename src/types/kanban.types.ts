export type Priority = 'low' | 'medium' | 'high' | 'urgent'
export type DueFilter = 'all' | 'overdue' | 'today' | 'week'
export type SortMode = 'manual' | 'priority' | 'due' | 'created'

export interface KanbanTag {
  name: string
  color: string
}

export interface Checkpoint {
  id: string
  label: string
  done: boolean
  order: number
}

export interface Subtask {
  id: string
  title: string
  done: boolean
  order: number
  checkpoints: Checkpoint[]
}

export interface TaskComment {
  id: string
  content: string
  createdAt: string
  updatedAt?: string
}

export interface TaskAttachment {
  id: string
  name: string
  data: string
  type: string
  size: number
  createdAt: string
}

export interface KanbanTask {
  id: string
  title: string
  description?: string
  columnId: string
  order: number
  priority: Priority | null
  due?: string
  tags: string[]
  linkedNotes: string[]
  linkedTasks: string[]
  subtasks: Subtask[]
  comments: TaskComment[]
  attachments: TaskAttachment[]
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export interface KanbanColumn {
  id: string
  title: string
  color: string
  order: number
  wipLimit?: number
}

export interface Board {
  id: string
  title: string
  description?: string
  createdAt: string
  updatedAt: string
  columns: KanbanColumn[]
  tasks: KanbanTask[]
  boardTags: KanbanTag[]
}

export interface KanbanFilters {
  tags: string[]
  priorities: Priority[]
  due: DueFilter
  linkedNote: string | null
  sort: SortMode
}
