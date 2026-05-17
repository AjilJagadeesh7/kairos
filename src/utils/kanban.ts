import type { Board, KanbanTask, KanbanColumn, KanbanFilters, KanbanTag, Priority } from '../types/kanban.types'

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

  for (const col of sortedColumns) {
    lines.push(`## ${col.title}`, '')
    const colTasks = board.tasks
      .filter(t => t.columnId === col.id)
      .sort((a, b) => a.order - b.order)

    for (const task of colTasks) {
      const done = !!task.completedAt
      const tagStr = task.tags.map(t => `#${t}`).join(' ')
      const tagsDisplay = tagStr ? ` ${tagStr}` : ''
      lines.push(`- [${done ? 'x' : ' '}] ${task.title}${tagsDisplay}`)

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
