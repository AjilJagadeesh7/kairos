/**
 * The board as the model sees it: one compact line per card. When the whole
 * board doesn't fit the budget, code picks the cards most relevant to the
 * user's message (deterministic retrieval) and says exactly how many were
 * left out — counts always come from the facts, never from this listing.
 */
import { estimateTokens } from '../text/tokens'
import { doneColumnId } from '../../utils/kanban'
import { dueDay } from './boardFacts'
import type { Board, KanbanTask } from '../../types'

const DESC_CHARS = 140
const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'card', 'cards', 'move', 'add', 'all', 'to', 'into',
  'from', 'board', 'column', 'please', 'make', 'set', 'put', 'update', 'rename', 'change', 'new',
])

function oneLine(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

export function cardLine(t: KanbanTask, board: Board, colName: Map<string, string>): string {
  const parent = t.parentId ? board.tasks.find((p) => p.id === t.parentId)?.key : undefined
  const attrs = [
    `[${colName.get(t.columnId) ?? '?'}]`,
    t.type !== 'task' ? `type=${t.type}` : '',
    t.priority ? `priority=${t.priority}` : '',
    dueDay(t.due) ? `due=${dueDay(t.due)}` : '',
    t.tags.length ? `tags=${t.tags.join(',')}` : '',
    parent ? `parent=${parent}` : '',
  ].filter(Boolean).join(' ')
  const desc = t.description?.trim() ? `\n  desc: ${oneLine(t.description, DESC_CHARS)}` : ''
  return `- ${t.key} "${oneLine(t.title, 160)}" ${attrs}${desc}`
}

export function words(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}-]*/gu) ?? []).filter((w) => w.length > 2 && !STOPWORDS.has(w))
}

/** How strongly a card matches the message: key mentions win, then word overlap. */
export function relevance(t: KanbanTask, query: string, queryWords: Set<string>, colTitle: string): number {
  if (t.key && new RegExp(`\\b${t.key.replace(/[-]/g, '\\-')}\\b`, 'i').test(query)) return 100
  const hay = new Set(words(`${t.title} ${t.tags.join(' ')} ${colTitle}`))
  let score = 0
  for (const w of queryWords) if (hay.has(w)) score += 1
  return score
}

export interface BoardListing {
  text: string
  listed: number
  omitted: number
}

/**
 * The board header and as many card lines as fit in `maxTokens`. Everything
 * fits on most boards; otherwise cards matching `query` go first, then open
 * cards, most recently updated first.
 */
export function boardListing(board: Board, query: string, maxTokens: number): BoardListing {
  const columns = [...board.columns].sort((a, b) => a.order - b.order)
  const colName = new Map(columns.map((c) => [c.id, c.title]))
  const colIndex = new Map(columns.map((c, i) => [c.id, i]))
  const doneId = doneColumnId(board)
  const header = [
    `Board: ${board.title}`,
    `Columns, in order: ${columns.map((c) => (c.id === doneId ? `${c.title} (done column)` : c.title)).join(' | ')}`,
    board.boardTags.length ? `Tags in use: ${board.boardTags.map((t) => t.name).join(', ')}` : '',
    'Cards:',
  ].filter(Boolean).join('\n')

  const lines = new Map(board.tasks.map((t) => [t.id, cardLine(t, board, colName)]))
  const inBoardOrder = (a: KanbanTask, b: KanbanTask) =>
    (colIndex.get(a.columnId) ?? 99) - (colIndex.get(b.columnId) ?? 99) || a.order - b.order
  // 20 tokens held back for the "N more cards not listed" line.
  let budget = maxTokens - estimateTokens(header) - 20
  const all = [...board.tasks].sort(inBoardOrder)
  const total = all.reduce((n, t) => n + estimateTokens(lines.get(t.id)!) + 1, 0)

  let chosen = all
  if (total > budget) {
    const qw = new Set(words(query))
    const ranked = [...board.tasks].sort((a, b) =>
      relevance(b, query, qw, colName.get(b.columnId) ?? '') - relevance(a, query, qw, colName.get(a.columnId) ?? '')
      || Number(a.columnId === doneId) - Number(b.columnId === doneId)
      || b.updatedAt.localeCompare(a.updatedAt))
    const keep = new Set<string>()
    for (const t of ranked) {
      const cost = estimateTokens(lines.get(t.id)!) + 1
      if (cost > budget) continue
      keep.add(t.id)
      budget -= cost
    }
    chosen = all.filter((t) => keep.has(t.id))
  }

  const omitted = board.tasks.length - chosen.length
  const body = chosen.length ? chosen.map((t) => lines.get(t.id)).join('\n') : '(no cards)'
  const note = omitted ? `\n(${omitted} more card${omitted === 1 ? '' : 's'} not listed here to save space)` : ''
  return { text: `${header}\n${body}${note}`, listed: chosen.length, omitted }
}
