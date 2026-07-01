import type { IconToken } from '../../icons/tokens'
import type { Note, JournalEntry, Canvas, PenNote, Attachment } from '../../types'
import type { KanbanTask, Board } from '../../types/kanban.types'
import { todayDate } from '../../store/useJournalStore'

export interface NavItem {
  kind: 'nav'
  id: string
  label: string
  hint: string
  iconName: IconToken
  path?: string
  action?: () => void
}

export type ResultItem =
  | { kind: 'note';    note: Note;                      score: number }
  | { kind: 'journal'; entry: JournalEntry;             score: number }
  | { kind: 'task';    task: KanbanTask; board: Board;  score: number }
  | { kind: 'canvas';  canvas: Canvas;                  score: number }
  | { kind: 'pennote'; penNote: PenNote;                score: number }
  | { kind: 'attachment'; attachment: Attachment;       score: number }
  | NavItem

export interface GroupedSection {
  label: string
  items: ResultItem[]
}

export function itemKey(item: ResultItem): string {
  if (item.kind === 'note')    return `note:${item.note.id}`
  if (item.kind === 'journal') return `journal:${item.entry.date}`
  if (item.kind === 'task')    return `task:${item.task.id}`
  if (item.kind === 'canvas')  return `canvas:${item.canvas.id}`
  if (item.kind === 'pennote') return `pennote:${item.penNote.id}`
  if (item.kind === 'attachment') return `attachment:${item.attachment.id}`
  return item.id
}

export function groupResults(items: ResultItem[]): GroupedSection[] {
  const nav      = items.filter(i => i.kind === 'nav')
  const notes    = items.filter(i => i.kind === 'note')
  const journal  = items.filter(i => i.kind === 'journal')
  const tasks    = items.filter(i => i.kind === 'task')
  const canvases = items.filter(i => i.kind === 'canvas')
  const penNotes = items.filter(i => i.kind === 'pennote')
  const attachments = items.filter(i => i.kind === 'attachment')

  const sections: GroupedSection[] = []
  if (nav.length)      sections.push({ label: 'Navigate',     items: nav })
  if (notes.length)    sections.push({ label: 'Notes',        items: notes })
  if (penNotes.length) sections.push({ label: 'Pen notes',    items: penNotes })
  if (journal.length)  sections.push({ label: 'Journal',      items: journal })
  if (tasks.length)    sections.push({ label: 'Kanban tasks', items: tasks })
  if (canvases.length) sections.push({ label: 'Canvases',     items: canvases })
  if (attachments.length) sections.push({ label: 'Attachments', items: attachments })
  return sections
}

export const NAV_ITEMS: NavItem[] = [
  { kind: 'nav', id: 'nav-notes',      label: 'Notes',              hint: 'Open Notes',                    iconName: 'file-text',    path: '/notes' },
  { kind: 'nav', id: 'nav-pennote',    label: 'Pen notes',          hint: 'Open handwriting pen notes',     iconName: 'pen-line',     path: '/pennote' },
  { kind: 'nav', id: 'nav-journal',    label: 'Journal',            hint: "Open today's journal",           iconName: 'calendar-days', path: `/journal/${todayDate()}` },
  { kind: 'nav', id: 'nav-kanban',     label: 'Kanban',             hint: 'Open Kanban boards',             iconName: 'layout-list',  path: '/kanban' },
  { kind: 'nav', id: 'nav-canvas',     label: 'Canvas',             hint: 'Open Canvases',                  iconName: 'pen-tool',     path: '/canvas' },
  { kind: 'nav', id: 'nav-attachments', label: 'Attachments',       hint: 'Open Attachments',               iconName: 'paperclip',    path: '/attachments' },
  { kind: 'nav', id: 'nav-graph',      label: 'Knowledge Graph',    hint: 'Open Knowledge Graph',           iconName: 'network',      path: '/graph' },
  { kind: 'nav', id: 'nav-settings',   label: 'Settings',           hint: 'Open Settings',                  iconName: 'settings',     path: '/settings' },
  { kind: 'nav', id: 'nav-pricing',    label: 'Plans & Pricing',    hint: 'View and change your plan',      iconName: 'zap',     path: '/pricing' },
  { kind: 'nav', id: 'nav-new-note',   label: 'New note',           hint: 'Create a blank note',            iconName: 'plus',         path: undefined },
  { kind: 'nav', id: 'nav-s-general',  label: 'Settings → General', hint: 'Appearance, font, theme',        iconName: 'settings',     path: '/settings?section=general' },
  { kind: 'nav', id: 'nav-s-vault',    label: 'Settings → Vault',   hint: 'Connect or change vault folder', iconName: 'book-open',    path: '/settings?section=vault' },
  { kind: 'nav', id: 'nav-s-sync',     label: 'Settings → Sync',    hint: 'S3, WebDAV, Drive sync',         iconName: 'settings',     path: '/settings?section=storage-sync' },
  { kind: 'nav', id: 'nav-s-storage',  label: 'Settings → Storage & Limits', hint: 'Storage usage and plan limits', iconName: 'hard-drive', path: '/settings?section=storage' },
  { kind: 'nav', id: 'nav-s-ai',       label: 'Settings → AI',      hint: 'Semantic search, Ollama',        iconName: 'settings',     path: '/settings?section=ai' },
  { kind: 'nav', id: 'nav-s-plugins',  label: 'Settings → Plugins', hint: 'Manage installed plugins',       iconName: 'settings',     path: '/settings?section=plugins' },
  { kind: 'nav', id: 'nav-s-keyboard', label: 'Settings → Keyboard',hint: 'Customize key bindings',         iconName: 'settings',     path: '/settings?section=keyboard' },
  { kind: 'nav', id: 'nav-s-tags',     label: 'Settings → Tags',    hint: 'Tag colors and management',      iconName: 'settings',     path: '/settings?section=tags' },
  { kind: 'nav', id: 'nav-s-logs',     label: 'Settings → Logs',    hint: 'View error logs',                iconName: 'settings',     path: '/settings?section=logs' },
]
