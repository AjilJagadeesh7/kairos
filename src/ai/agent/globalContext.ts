/**
 * Board text for the global chat agent: every board's columns and tags, and
 * card listings that fit a token budget — all cards when they fit, otherwise
 * the ones most relevant to the message first.
 */
import { estimateTokens } from '../text/tokens'
import { doneColumnId } from '../../utils/kanban'
import { cardLine, relevance, words } from './boardContext'
import type { Board, KanbanTask } from '../../types'

export function boardsOverview(boards: Board[]): string {
  if (!boards.length) return 'Boards: none'
  return ['Boards:', ...boards.map((b) => {
    const done = doneColumnId(b)
    const cols = [...b.columns].sort((x, y) => x.order - y.order).map((c) => (c.id === done ? `${c.title} (done column)` : c.title))
    const tags = b.boardTags.length ? `; tags: ${b.boardTags.map((t) => t.name).join(', ')}` : ''
    return `- "${b.title}" — columns: ${cols.join(' | ')}${tags}`
  })].join('\n')
}

interface Listed { text: string; ids: string[]; listed: number; omitted: number }

/**
 * One line per card, as `- KEY "title" [Board › Column] …`. Everything when
 * it fits; otherwise cards matching `query` first, then open cards, newest first.
 */
export function cardListing(boards: Board[], query: string, maxTokens: number, keep: (t: KanbanTask, b: Board) => boolean = () => true): Listed {
  const entries: Array<{ t: KanbanTask; line: string; col: string; done: boolean }> = []
  for (const b of boards) {
    const cols = [...b.columns].sort((x, y) => x.order - y.order)
    const where = new Map(cols.map((c) => [c.id, `${b.title} › ${c.title}`]))
    const colIndex = new Map(cols.map((c, i) => [c.id, i]))
    const done = doneColumnId(b)
    // Board order, then column order, then card order — how the board shows them.
    const tasks = b.tasks.filter((t) => keep(t, b))
      .sort((x, y) => (colIndex.get(x.columnId) ?? 99) - (colIndex.get(y.columnId) ?? 99) || x.order - y.order)
    for (const t of tasks) {
      entries.push({ t, line: cardLine(t, b, where), col: where.get(t.columnId) ?? '', done: t.columnId === done })
    }
  }
  let budget = maxTokens - 20
  const total = entries.reduce((n, e) => n + estimateTokens(e.line) + 1, 0)
  let chosen = entries
  if (total > budget) {
    const qw = new Set(words(query))
    const ranked = [...entries].sort((x, y) =>
      relevance(y.t, query, qw, y.col) - relevance(x.t, query, qw, x.col)
      || Number(x.done) - Number(y.done)
      || y.t.updatedAt.localeCompare(x.t.updatedAt))
    const picked = new Set<string>()
    for (const e of ranked) {
      const cost = estimateTokens(e.line) + 1
      if (cost > budget) continue
      picked.add(e.t.id)
      budget -= cost
    }
    chosen = entries.filter((e) => picked.has(e.t.id))
  }
  const omitted = entries.length - chosen.length
  const body = chosen.length ? chosen.map((e) => e.line).join('\n') : '(no cards)'
  const more = omitted ? `\n(${omitted} more card${omitted === 1 ? '' : 's'} not listed — use list_cards to see them)` : ''
  return { text: `Cards:\n${body}${more}`, ids: chosen.map((e) => e.t.id), listed: chosen.length, omitted }
}
