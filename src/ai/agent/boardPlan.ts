/**
 * Turns the model's tool calls into a plan the user confirms. Every card and
 * column is resolved against this board in code; anything that doesn't
 * resolve stays in the plan, greyed with the reason, and is never executed.
 */
import { v4 as uuid } from 'uuid'
import { dueDay } from './boardFacts'
import type {
  Board, CardPatch, FieldChange, KanbanColumn, KanbanTask, PlanAction, Priority, ResolvedAction, ToolCall,
} from '../../types'

/** Larger plans are refused with a request to narrow the scope (PRD). */
export const MAX_PLAN_ACTIONS = 20

const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent']

type Found<T> = { ok: T } | { error: string }

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const quote = (s: string) => `"${s.length > 60 ? `${s.slice(0, 59)}…` : s}"`
const squash = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

/** A card by key ("KAI-4"), id, or — when unique — exact title. Only this board's cards resolve. */
export function resolveCard(board: Board, ref: string): Found<KanbanTask> {
  const r = ref.trim().replace(/^#/, '')
  const lower = r.toLowerCase()
  const byKey = board.tasks.find((t) => t.key?.toLowerCase() === lower || t.id === r)
  if (byKey) return { ok: byKey }
  const byTitle = board.tasks.filter((t) => t.title.trim().toLowerCase() === lower)
  if (byTitle.length === 1) return { ok: byTitle[0] }
  if (byTitle.length > 1) return { error: `${quote(r)} matches ${byTitle.length} cards — name it by key` }
  return { error: `Could not resolve card ${quote(r || '(none)')} on this board` }
}

/** Case-insensitive match first, then ignoring spaces and punctuation ("To Do" = "Todo"). */
export function resolveColumn(board: Board, name: string): Found<KanbanColumn> {
  const n = name.trim()
  const exact = board.columns.filter((c) => c.title.trim().toLowerCase() === n.toLowerCase())
  const loose = exact.length ? exact : board.columns.filter((c) => squash(c.title) === squash(n) && squash(n))
  if (loose.length === 1) return { ok: loose[0] }
  const names = [...board.columns].sort((a, b) => a.order - b.order).map((c) => c.title).join(', ')
  return { error: `No column named ${quote(n || '(none)')} (columns: ${names})` }
}

/** YYYY-MM-DD (or a full ISO string) → the stored form; anything else is refused. */
export function parseDue(raw: string): Found<string> {
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/)
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
    const date = new Date(Date.UTC(y, mo - 1, d))
    if (date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d) {
      return { ok: `${m[1]}-${m[2]}-${m[3]}T00:00:00.000Z` }
    }
  }
  return { error: `Due date ${quote(raw)} is not a YYYY-MM-DD date` }
}

/** "#Front End" → the board's existing "front-end" tag when one matches, else "Front End". */
export function normalizeTags(board: Board, raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : []
  const out: string[] = []
  for (const r of list) {
    const t = str(r).replace(/^#+/, '').replace(/\s+/g, ' ')
    if (!t) continue
    const existing = board.boardTags.find((b) => b.name.toLowerCase() === t.toLowerCase() || squash(b.name) === squash(t))
    const name = existing?.name ?? t
    if (!out.includes(name)) out.push(name)
  }
  return out
}

const show = {
  due: (d?: string) => dueDay(d) ?? '—',
  tags: (t?: string[]) => (t?.length ? t.join(', ') : '—'),
  text: (s?: string | null) => (s?.trim() ? s.trim() : '—'),
}

function unresolved(call: ToolCall, summary: string, reason: string): PlanAction {
  return { id: uuid(), tool: call.name, summary, changes: [], resolved: null, unresolved: reason }
}

function createAction(call: ToolCall, board: Board): PlanAction {
  const a = call.args
  const title = str(a.title)
  const summary = `Add ${quote(title || 'untitled')} to ${str(a.column) || '?'}`
  if (!title) return unresolved(call, summary, 'The card has no title')
  const col = resolveColumn(board, str(a.column))
  if ('error' in col) return unresolved(call, summary, col.error)
  let due: string | undefined
  if (str(a.due)) {
    const d = parseDue(str(a.due))
    if ('error' in d) return unresolved(call, summary, d.error)
    due = d.ok
  }
  const priority = PRIORITIES.includes(a.priority as Priority) ? (a.priority as Priority) : null
  const description = str(a.description) || undefined
  const tags = normalizeTags(board, a.tags)
  const changes: FieldChange[] = [
    { field: 'column', before: '—', after: col.ok.title },
    { field: 'title', before: '—', after: title },
    ...(description ? [{ field: 'description' as const, before: '—', after: description }] : []),
    ...(due ? [{ field: 'due' as const, before: '—', after: show.due(due) }] : []),
    ...(tags.length ? [{ field: 'tags' as const, before: '—', after: show.tags(tags) }] : []),
    ...(priority ? [{ field: 'priority' as const, before: '—', after: priority }] : []),
  ]
  const resolved: ResolvedAction = { tool: 'create_card', columnId: col.ok.id, title, description, due, tags, priority }
  return { id: uuid(), tool: call.name, summary: `Add ${quote(title)} to ${col.ok.title}`, changes, resolved }
}

function moveAction(call: ToolCall, board: Board): PlanAction {
  const ref = str(call.args.cardId)
  const summary = `Move ${quote(ref)} → ${str(call.args.toColumn) || '?'}`
  const card = resolveCard(board, ref)
  if ('error' in card) return unresolved(call, summary, card.error)
  const col = resolveColumn(board, str(call.args.toColumn))
  const label = `${card.ok.key} ${quote(card.ok.title)}`
  if ('error' in col) return unresolved(call, `Move ${label} → ${str(call.args.toColumn)}`, col.error)
  const from = board.columns.find((c) => c.id === card.ok.columnId)?.title ?? '?'
  const line = `Move ${label} → ${col.ok.title}`
  if (col.ok.id === card.ok.columnId) return unresolved(call, line, `Already in ${col.ok.title}`)
  return {
    id: uuid(), tool: call.name, summary: line,
    changes: [{ field: 'column', before: from, after: col.ok.title }],
    resolved: { tool: 'move_card', taskId: card.ok.id, toColumnId: col.ok.id },
  }
}

function updateAction(call: ToolCall, board: Board): PlanAction {
  const a = call.args
  const ref = str(a.cardId)
  const card = resolveCard(board, ref)
  if ('error' in card) return unresolved(call, `Update ${quote(ref)}`, card.error)
  const t = card.ok
  const label = `${t.key} ${quote(t.title)}`
  const patch: CardPatch = {}
  const changes: FieldChange[] = []

  if (str(a.title) && str(a.title) !== t.title) {
    patch.title = str(a.title)
    changes.push({ field: 'title', before: t.title, after: patch.title })
  }
  if (typeof a.description === 'string' && str(a.description) !== (t.description ?? '').trim()) {
    patch.description = str(a.description)
    changes.push({ field: 'description', before: show.text(t.description), after: show.text(patch.description) })
  }
  if (str(a.due)) {
    const d = parseDue(str(a.due))
    if ('error' in d) return unresolved(call, `Update ${label}`, d.error)
    if (dueDay(d.ok) !== dueDay(t.due)) {
      patch.due = d.ok
      changes.push({ field: 'due', before: show.due(t.due), after: show.due(d.ok) })
    }
  }
  if (PRIORITIES.includes(a.priority as Priority) && a.priority !== t.priority) {
    patch.priority = a.priority as Priority
    changes.push({ field: 'priority', before: t.priority ?? '—', after: patch.priority })
  }
  const add = normalizeTags(board, a.addTags)
  const remove = normalizeTags(board, a.removeTags).map((r) => r.toLowerCase())
  const tags = [...t.tags.filter((x) => !remove.includes(x.toLowerCase())), ...add.filter((x) => !t.tags.includes(x))]
  if (tags.join('\u0000') !== t.tags.join('\u0000')) {
    patch.tags = tags
    changes.push({ field: 'tags', before: show.tags(t.tags), after: show.tags(tags) })
  }

  const fields = changes.map((c) => c.field).join(', ')
  const summary = changes.length === 1 && patch.title
    ? `Rename ${t.key} ${quote(t.title)} → ${quote(patch.title)}`
    : `Update ${label}${fields ? `: ${fields}` : ''}`
  if (!changes.length) return unresolved(call, summary, 'No change — the card already has these values')
  return { id: uuid(), tool: call.name, summary, changes, resolved: { tool: 'update_card', taskId: t.id, patch } }
}

/** Validates every call against the board. Returns null when the plan is too large. */
export function planFromToolCalls(calls: ToolCall[], board: Board): PlanAction[] | null {
  if (calls.length > MAX_PLAN_ACTIONS) return null
  const touched = new Set<string>()
  return calls.map((call) => {
    const action = call.name === 'create_card' ? createAction(call, board)
      : call.name === 'move_card' ? moveAction(call, board)
      : call.name === 'update_card' ? updateAction(call, board)
      : unresolved(call, `${call.name}`, `"${call.name}" is not available on a board`)
    // Two moves (or two edits) of the same card would fight; keep the first.
    const r = action.resolved
    if (r && r.tool !== 'create_card') {
      const key = `${r.tool}:${r.taskId}`
      if (touched.has(key)) return { ...action, resolved: null, unresolved: 'Another action in this plan already changes this card' }
      touched.add(key)
    }
    return action
  })
}
