import type { Board, KanbanTask, KanbanColumn, KanbanFilters, KanbanTag, Priority, IssueType } from '../types/kanban.types'
import type { IconToken } from '../icons/tokens'

/** Display metadata for each Jira-style issue type. */
export const ISSUE_TYPE_META: Record<IssueType, { label: string; icon: IconToken; color: string }> = {
  story:   { label: 'Story',   icon: 'bookmark',     color: '#22c55e' },
  task:    { label: 'Task',    icon: 'check-square', color: '#3b82f6' },
  bug:     { label: 'Bug',     icon: 'bug',          color: '#ef4444' },
  subtask: { label: 'Subtask', icon: 'git-fork',     color: '#6366f1' },
}

export const ISSUE_TYPES: IssueType[] = ['story', 'task', 'bug', 'subtask']
/** Types allowed for a top-level (parentless) issue. */
export const PARENT_ISSUE_TYPES: IssueType[] = ['story', 'task', 'bug']
/** Types allowed for a child issue nested under a parent. */
export const CHILD_ISSUE_TYPES: IssueType[] = ['subtask', 'bug']

/** Derives a stable key prefix (e.g. "KAI") from a board title. */
export function deriveKeyPrefix(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean)
  const raw = words.length >= 2
    ? words.slice(0, 3).map(w => w[0]).join('')
    : (words[0] ?? 'TASK').slice(0, 4)
  return raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'TASK'
}

export function taskKey(prefix: string, n: number): string {
  return `${prefix}-${n}`
}

/** Extracts the trailing sequence number from a key, or 0 if absent. */
export function keySeq(key: string | undefined): number {
  if (!key) return 0
  const m = key.match(/-(\d+)$/)
  return m ? Number(m[1]) : 0
}

/** The board's terminal "done" column id (explicit flag, else the last column). */
export function doneColumnId(board: Board): string | undefined {
  const flagged = board.columns.find(c => c.isDone)
  if (flagged) return flagged.id
  const sorted = [...board.columns].sort((a, b) => a.order - b.order)
  return sorted[sorted.length - 1]?.id
}

export function isTaskDone(task: KanbanTask, board: Board): boolean {
  return task.columnId === doneColumnId(board)
}

/** A task/issue is overdue when it has a past due date and isn't in a done column. */
export function isTaskOverdue(task: KanbanTask, board: Board): boolean {
  return !!task.due && !isTaskDone(task, board) && isDueOverdue(task.due)
}

/** Child-issue rollup: how many first-class children sit in the done column. */
export function calcChildProgress(task: KanbanTask, board: Board): { done: number; total: number } {
  const children = board.tasks.filter(t => t.parentId === task.id)
  if (children.length === 0) return { done: 0, total: 0 }
  const done = children.filter(c => isTaskDone(c, board)).length
  return { done, total: children.length }
}

export const PRIORITY_COLORS: Record<Priority, string> = {
  low: '#94a3b8',
  medium: '#3b82f6',
  high: '#f97316',
  urgent: '#ef4444',
}

export const PRIORITY_ORDER: Record<Priority | 'none', number> = {
  urgent: 0, high: 1, medium: 2, low: 3, none: 4,
}

export const TAG_COLOR_PALETTE = [
  '#FF6B6B', '#FFE66D', '#A8E6CF', '#74B9FF',
  '#6C5CE7', '#00B894', '#FD79A8', '#FDCB6E',
  '#E17055', '#00CEC9', '#55EFC4', '#a29bfe',
]

export const DEFAULT_COLUMN_COLORS = ['#e8ff00', '#00ffaa', '#ff6b35', '#888888']

/** Returns black or white depending on which contrasts better with the hex background. */
export function tagTextColor(hexBg: string): string {
  const r = parseInt(hexBg.slice(1, 3), 16)
  const g = parseInt(hexBg.slice(3, 5), 16)
  const b = parseInt(hexBg.slice(5, 7), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) > 140 ? '#111111' : '#ffffff'
}

export function nextTagColor(existingTags: KanbanTag[]): string {
  const used = new Set(existingTags.map(t => t.color))
  return TAG_COLOR_PALETTE.find(c => !used.has(c)) ?? TAG_COLOR_PALETTE[existingTags.length % TAG_COLOR_PALETTE.length]
}

export function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(isoDate))
}

export function formatDateShort(isoDate: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(isoDate))
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function isDueOverdue(isoDate: string): boolean {
  const due = new Date(isoDate)
  const now = new Date()
  return due < now && !isSameDay(due, now)
}

export function isDueToday(isoDate: string): boolean {
  return isSameDay(new Date(isoDate), new Date())
}

export function isDueThisWeek(isoDate: string): boolean {
  const due = new Date(isoDate)
  const now = new Date()
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  return due >= now && due <= weekFromNow
}

export type DueState = 'overdue' | 'today' | 'soon' | 'normal'
export function getDueState(isoDate?: string): DueState {
  if (!isoDate) return 'normal'
  if (isDueOverdue(isoDate)) return 'overdue'
  if (isDueToday(isoDate)) return 'today'
  if (isDueThisWeek(isoDate)) return 'soon'
  return 'normal'
}

export function calcSubtaskProgress(subtask: import('../types/kanban.types').Subtask): number {
  if (subtask.done) return 1
  const cps = subtask.checkpoints
  if (cps.length === 0) return 0
  return cps.filter(c => c.done).length / cps.length
}

export function calcTaskProgress(task: KanbanTask): { done: number; total: number } {
  const total = task.subtasks.length
  if (total === 0) return { done: 0, total: 0 }
  const done = task.subtasks.filter(s => {
    if (s.done) return true
    if (s.checkpoints.length === 0) return false
    return s.checkpoints.every(c => c.done)
  }).length
  return { done, total }
}

export function filterAndSortTasks(tasks: KanbanTask[], filters: KanbanFilters): KanbanTask[] {
  let result = [...tasks]

  if (filters.tags.length > 0) {
    result = result.filter(t => filters.tags.some(tag => t.tags.includes(tag)))
  }

  if (filters.priorities.length > 0) {
    result = result.filter(t => t.priority && filters.priorities.includes(t.priority))
  }

  if (filters.types?.length) {
    result = result.filter(t => filters.types.includes(t.type))
  }

  if (filters.query?.trim()) {
    const q = filters.query.trim().toLowerCase()
    result = result.filter(t =>
      t.title.toLowerCase().includes(q) || (t.key ?? '').toLowerCase().includes(q),
    )
  }

  if (filters.sprint) {
    result = filters.sprint === '__backlog__'
      ? result.filter(t => !t.sprintId)
      : result.filter(t => t.sprintId === filters.sprint)
  }

  if (filters.due !== 'all') {
    result = result.filter(t => {
      if (!t.due) return false
      if (filters.due === 'overdue') return isDueOverdue(t.due)
      if (filters.due === 'today') return isDueToday(t.due)
      if (filters.due === 'week') return isDueThisWeek(t.due)
      return true
    })
  }

  if (filters.linkedNote) {
    result = result.filter(t => t.linkedNotes.includes(filters.linkedNote!))
  }

  if (filters.sort !== 'manual') {
    result.sort((a, b) => {
      if (filters.sort === 'priority') {
        const ao = PRIORITY_ORDER[a.priority ?? 'none']
        const bo = PRIORITY_ORDER[b.priority ?? 'none']
        return ao - bo
      }
      if (filters.sort === 'due') {
        if (!a.due && !b.due) return 0
        if (!a.due) return 1
        if (!b.due) return -1
        return new Date(a.due).getTime() - new Date(b.due).getTime()
      }
      if (filters.sort === 'created') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      }
      return a.order - b.order
    })
  }

  return result
}

export function exportBoardToMarkdown(board: Board): string {
  const sortedColumns = [...board.columns].sort((a, b) => a.order - b.order)

  const lines: string[] = [`# ${board.title}`, '']

  const doneCol = doneColumnId(board)
  for (const col of sortedColumns) {
    lines.push(`## ${col.title}`, '')
    // Only top-level issues head a column; children are nested beneath their parent.
    const colTasks = board.tasks
      .filter(t => t.columnId === col.id && !t.parentId)
      .sort((a, b) => a.order - b.order)

    for (const task of colTasks) {
      const done = !!task.completedAt || task.columnId === doneCol
      const keyStr = task.key ? `${task.key} ` : ''
      const tagStr = task.tags.map(t => `#${t}`).join(' ')
      const tagsDisplay = tagStr ? ` ${tagStr}` : ''
      lines.push(`- [${done ? 'x' : ' '}] ${keyStr}${task.title}${tagsDisplay}`)

      const children = board.tasks
        .filter(t => t.parentId === task.id)
        .sort((a, b) => a.order - b.order)
      for (const child of children) {
        const childDone = !!child.completedAt || child.columnId === doneCol
        const ck = child.key ? `${child.key} ` : ''
        lines.push(`  - [${childDone ? 'x' : ' '}] ${ck}${child.title}`)
      }

      for (const sub of [...task.subtasks].sort((a, b) => a.order - b.order)) {
        const subDone = sub.done || (sub.checkpoints.length > 0 && sub.checkpoints.every(c => c.done))
        lines.push(`  - [${subDone ? 'x' : ' '}] ${sub.title}`)
        for (const cp of [...sub.checkpoints].sort((a, b) => a.order - b.order)) {
          lines.push(`    - [${cp.done ? 'x' : ' '}] ${cp.label}`)
        }
      }
    }
    lines.push('')
  }

  return lines.join('\n')
}

export function exportBoardToJSON(board: Board): string {
  return JSON.stringify(board, null, 2)
}

export function duplicateBoardWithNewIds(board: Board, idFn: () => string): Board {
  const colIdMap = new Map<string, string>()
  const taskIdMap = new Map<string, string>()

  const columns: KanbanColumn[] = board.columns.map(c => {
    const newId = idFn()
    colIdMap.set(c.id, newId)
    return { ...c, id: newId }
  })

  const tasks: KanbanTask[] = board.tasks.map(t => {
    const newId = idFn()
    taskIdMap.set(t.id, newId)
    const newColumnId = colIdMap.get(t.columnId) ?? t.columnId
    return {
      ...t,
      id: newId,
      columnId: newColumnId,
      linkedTasks: t.linkedTasks.map(lt => taskIdMap.get(lt) ?? lt),
      subtasks: t.subtasks.map(s => ({
        ...s,
        id: idFn(),
        checkpoints: s.checkpoints.map(c => ({ ...c, id: idFn() })),
      })),
    }
  })

  // Re-point parent links to the duplicated child ids.
  for (const t of tasks) {
    if (t.parentId) t.parentId = taskIdMap.get(t.parentId) ?? t.parentId
  }

  const now = new Date().toISOString()
  return {
    ...board,
    id: idFn(),
    title: `Copy of ${board.title}`,
    columns,
    tasks,
    createdAt: now,
    updatedAt: now,
  }
}
