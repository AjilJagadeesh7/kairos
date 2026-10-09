/**
 * Facts across the vault for the global chat, computed in code so the model
 * never counts: what's pending, and day/week/month reviews. Done and overdue
 * use the board UI's own helpers; journal entries count as notes.
 */
import { doneColumnId, isDueOverdue } from '../../utils/kanban'
import { isoDate } from '../text/relativeDates'
import { dueDay, FACT_LIST_CAP } from './boardFacts'
import type {
  Board, ChatSourceRef, FactCard, FactList, KanbanTask, NoteOpenItems, NoteRef, PendingFacts, ReviewFacts, ReviewPeriod, VaultSnapshot,
} from '../../types'

const UNCHECKED = /^\s*[-*+]\s+\[ \]\s+(.+)$/gm
const NOTE_LIST_CAP = 10
const SAMPLE_ITEMS = 3

function list(cards: FactCard[]): FactList {
  return { count: cards.length, cards: cards.slice(0, FACT_LIST_CAP) }
}

function card(t: KanbanTask, b: Board, colName: Map<string, string>): FactCard {
  return {
    id: t.id, boardId: b.id, board: b.title, key: t.key, title: t.title, column: colName.get(t.columnId) ?? '?',
    ...(dueDay(t.due) ? { due: dueDay(t.due) } : {}),
  }
}

/** Every card with its board, plus whether it's done. */
function allCards(boards: Board[]) {
  return boards.flatMap((b) => {
    const doneId = doneColumnId(b)
    const colName = new Map(b.columns.map((c) => [c.id, c.title]))
    return b.tasks.map((t) => ({ t, b, done: t.columnId === doneId, fact: card(t, b, colName) }))
  })
}

const byDue = (a: { t: KanbanTask }, b: { t: KanbanTask }) => (a.t.due ?? '').localeCompare(b.t.due ?? '')

function noteRefs(vault: VaultSnapshot): Array<NoteRef & { content: string; createdAt: string; updatedAt: string }> {
  return [
    ...vault.notes.map((n) => ({ id: n.id, kind: 'note' as const, title: n.title || 'Untitled note', content: n.content, createdAt: n.createdAt, updatedAt: n.updatedAt })),
    ...vault.journal.map((j) => ({ id: j.date, kind: 'journal' as const, title: `Journal ${j.date}`, content: j.content, createdAt: `${j.date}T00:00:00`, updatedAt: j.updatedAt })),
  ]
}

/** Sunday of the current week, local. */
export function weekEnd(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + ((7 - now.getDay()) % 7))
}

export function computePendingFacts(vault: VaultSnapshot, now: Date): PendingFacts {
  const today = isoDate(now)
  const end = isoDate(weekEnd(now))
  const open = allCards(vault.boards).filter((c) => !c.done)
  const overdue = open.filter((c) => c.t.due && isDueOverdue(c.t.due)).sort(byDue)
  const overdueIds = new Set(overdue.map((c) => c.t.id))
  const thisWeek = open
    .filter((c) => !overdueIds.has(c.t.id) && dueDay(c.t.due) && dueDay(c.t.due)! >= today && dueDay(c.t.due)! <= end)
    .sort(byDue)

  const withItems: NoteOpenItems[] = noteRefs(vault).flatMap((n) => {
    const items = [...n.content.matchAll(UNCHECKED)].map((m) => m[1].trim())
    return items.length ? [{ id: n.id, kind: n.kind, title: n.title, open: items.length, items: items.slice(0, SAMPLE_ITEMS) }] : []
  }).sort((a, b) => b.open - a.open)

  return {
    kind: 'pending',
    today,
    weekEnd: end,
    overdue: list(overdue.map((c) => c.fact)),
    dueThisWeek: list(thisWeek.map((c) => c.fact)),
    openCards: open.length,
    notesWithOpenItems: {
      count: withItems.length,
      openItems: withItems.reduce((n, x) => n + x.open, 0),
      notes: withItems.slice(0, NOTE_LIST_CAP),
    },
  }
}

/** Start of the period, local midnight: today, this Monday, or the 1st. */
export function periodStart(period: ReviewPeriod, now: Date): Date {
  if (period === 'day') return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (period === 'week') return new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

export function computeReviewFacts(vault: VaultSnapshot, period: ReviewPeriod, now: Date): ReviewFacts {
  const start = periodStart(period, now)
  const since = start.toISOString()
  const sinceDay = isoDate(start)
  const inPeriod = (iso: string | undefined) => !!iso && iso >= since
  const refs = noteRefs(vault)
  const notes = refs.filter((n) => n.kind === 'note')
  const created = notes.filter((n) => inPeriod(n.createdAt))
  const edited = notes.filter((n) => !inPeriod(n.createdAt) && inPeriod(n.updatedAt))
  const journal = refs.filter((n) => n.kind === 'journal' && n.id >= sinceDay && n.content.trim())
  const ref = ({ id, kind, title }: NoteRef): NoteRef => ({ id, kind, title })
  const cards = allCards(vault.boards)
  const recent = (key: 'createdAt' | 'completedAt' | 'movedAt') =>
    cards.filter((c) => inPeriod(c.t[key]) && (key !== 'completedAt' || c.done))
      .sort((a, b) => (b.t[key] ?? '').localeCompare(a.t[key] ?? ''))
      .map((c) => c.fact)

  return {
    kind: 'review',
    period,
    since: sinceDay,
    today: isoDate(now),
    notesCreated: { count: created.length, notes: created.slice(0, NOTE_LIST_CAP).map(ref) },
    notesEdited: { count: edited.length, notes: edited.slice(0, NOTE_LIST_CAP).map(ref) },
    journalEntries: { count: journal.length, notes: journal.slice(0, NOTE_LIST_CAP).map(ref) },
    cardsCreated: list(recent('createdAt')),
    cardsCompleted: list(recent('completedAt')),
    cardsMoved: list(recent('movedAt')),
    overdueNow: cards.filter((c) => !c.done && c.t.due && isDueOverdue(c.t.due)).length,
  }
}

/** "3 overdue · 5 due this week · 12 open checklist items" */
export function vaultFactsHeader(f: PendingFacts | ReviewFacts): string {
  if (f.kind === 'pending') {
    return `${f.overdue.count} overdue · ${f.dueThisWeek.count} due this week · ${f.notesWithOpenItems.openItems} open checklist item${f.notesWithOpenItems.openItems === 1 ? '' : 's'}`
  }
  const label = f.period === 'day' ? 'Today' : f.period === 'week' ? `Since Monday ${f.since}` : `Since ${f.since}`
  return `${label} · ${f.notesCreated.count} notes created · ${f.notesEdited.count} edited · ${f.cardsCompleted.count} cards completed`
}

/** The cards and notes a set of facts lists, as source chips. */
export function factSources(f: PendingFacts | ReviewFacts): ChatSourceRef[] {
  const out: ChatSourceRef[] = []
  const seen = new Set<string>()
  const push = (s: ChatSourceRef) => {
    const k = `${s.kind}:${s.id}`
    if (!seen.has(k)) { seen.add(k); out.push(s) }
  }
  const cards = f.kind === 'pending'
    ? [...f.overdue.cards, ...f.dueThisWeek.cards]
    : [...f.cardsCompleted.cards, ...f.cardsMoved.cards, ...f.cardsCreated.cards]
  const notes = f.kind === 'pending'
    ? f.notesWithOpenItems.notes
    : [...f.notesCreated.notes, ...f.notesEdited.notes, ...f.journalEntries.notes]
  for (const c of cards) if (c.id) push({ kind: 'card', id: c.id, boardId: c.boardId, title: `${c.key} ${c.title}` })
  for (const n of notes) push({ kind: n.kind, id: n.id, title: n.title })
  return out
}
