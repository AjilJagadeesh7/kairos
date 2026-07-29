export type Priority = 'low' | 'medium' | 'high' | 'urgent'
export type DueFilter = 'all' | 'overdue' | 'today' | 'week'
export type SortMode = 'manual' | 'priority' | 'due' | 'created'

/** Jira-style issue types. `story`/`task`/`bug` are top-level; `subtask` is a child. */
export type IssueType = 'story' | 'task' | 'bug' | 'subtask'

/** Which board view is active. Persisted in the URL via `?view=`. */
export type KanbanView = 'board' | 'list' | 'timeline' | 'backlog' | 'summary'

/** Board grouping: flat (parents only) or swimlanes grouped by parent. */
export type BoardGroupBy = 'none' | 'parent'

export type SprintStatus = 'planned' | 'active' | 'completed'

export interface Sprint {
  id: string
  name: string
  goal?: string
  startDate?: string
  endDate?: string
  status: SprintStatus
  order: number
}

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
  /** Human-readable, board-unique key, e.g. "KAI-42". Stable once assigned. */
  key: string
  /** Issue type — drives the icon and whether it renders as a child. */
  type: IssueType
  /** Parent issue id when this is a subtask/bug nested under another issue. */
  parentId?: string | null
  title: string
  description?: string
  columnId: string
  order: number
  priority: Priority | null
  /** Planned start — used by the Timeline (Gantt) view. */
  startDate?: string
  due?: string
  /** Sprint this issue belongs to; null/undefined = backlog. */
  sprintId?: string | null
  tags: string[]
  linkedNotes: string[]
  linkedTasks: string[]
  /** Legacy embedded checklist. New issues use first-class children (parentId). */
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
  /** Marks the terminal "done" status — used for progress + summary rollups. */
  isDone?: boolean
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
  /** Prefix for issue keys, e.g. "KAI". Derived from the title on first load. */
  keyPrefix?: string
  /** Highest issue-key sequence number handed out so far. */
  seq?: number
  sprints?: Sprint[]
  noSync?: boolean  // when true, this board stays local-only (never pushed to remotes)
}

export interface KanbanFilters {
  tags: string[]
  priorities: Priority[]
  types: IssueType[]
  due: DueFilter
  linkedNote: string | null
  query: string
  /** Sprint scope: null = all, '__backlog__' = no sprint, else a sprint id. */
  sprint: string | null
  sort: SortMode
}
