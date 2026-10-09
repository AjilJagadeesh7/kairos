/**
 * Resolves the names the model uses in the global chat — boards, cards,
 * notes — to real items. Cards and notes must also be among those the model
 * was shown in this request (`allowed`), so text it was never given can't
 * steer an action to some other item.
 */
import type { Board, KanbanTask, Note } from '../../types'

export type Found<T> = { ok: T } | { error: string }

const squash = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
const quote = (s: string) => `"${s.length > 60 ? `${s.slice(0, 59)}…` : s}"`

/** By id, then case-insensitive title, then title ignoring spaces and punctuation. */
export function resolveBoard(boards: Board[], ref: string): Found<Board> {
  const r = ref.trim()
  const byId = boards.find((b) => b.id === r)
  if (byId) return { ok: byId }
  const exact = boards.filter((b) => b.title.trim().toLowerCase() === r.toLowerCase())
  const loose = exact.length ? exact : boards.filter((b) => squash(r) && squash(b.title) === squash(r))
  if (loose.length === 1) return { ok: loose[0] }
  if (loose.length > 1) return { error: `${quote(r)} matches ${loose.length} boards` }
  return { error: `No board named ${quote(r || '(none)')} (boards: ${boards.map((b) => b.title).join(', ') || 'none'})` }
}

export interface CardHit { board: Board; task: KanbanTask }

/** A card by key or id (or a unique exact title), optionally on a named board. */
export function findCard(boards: Board[], ref: string, boardRef: string, allowed: Set<string>): Found<CardHit> {
  let scope = boards
  if (boardRef.trim()) {
    const b = resolveBoard(boards, boardRef)
    if ('error' in b) return b
    scope = [b.ok]
  }
  const r = ref.trim().replace(/^#/, '')
  const lower = r.toLowerCase()
  const all = scope.flatMap((board) => board.tasks.map((task) => ({ board, task })))
  let hits = all.filter(({ task }) => task.key?.toLowerCase() === lower || task.id === r)
  if (!hits.length) hits = all.filter(({ task }) => task.title.trim().toLowerCase() === lower)
  if (!hits.length) return { error: `Could not resolve card ${quote(r || '(none)')}` }
  const shown = hits.filter(({ task }) => allowed.has(task.id))
  if (!shown.length) return { error: `${quote(r)} wasn't among the cards the assistant was shown for this request` }
  if (shown.length > 1) {
    const where = [...new Set(shown.map((h) => h.board.title))]
    return { error: where.length > 1 ? `${quote(r)} matches cards on ${where.join(' and ')} — name the board` : `${quote(r)} matches ${shown.length} cards — name it by key` }
  }
  return { ok: shown[0] }
}

/** A note by id, or by exact title when only one note has it. `allowed` null: any note. */
export function resolveNote(notes: Note[], ref: string, allowed: Set<string> | null): Found<Note> {
  const r = ref.trim().replace(/^\[\[|\]\]$/g, '')
  const byId = notes.find((n) => n.id === r)
  const byTitle = byId ? [byId] : notes.filter((n) => n.title.trim().toLowerCase() === r.toLowerCase())
  if (!byTitle.length) return { error: `Could not resolve note ${quote(r || '(none)')}` }
  if (byTitle.length > 1) return { error: `${byTitle.length} notes are titled ${quote(r)} — name it by id` }
  const note = byTitle[0]
  if (allowed && !allowed.has(note.id)) return { error: `${quote(note.title)} wasn't among the notes the assistant was shown for this request` }
  return { ok: note }
}

/** An existing folder path, matched case-insensitively. Empty = the vault root. */
export function resolveFolder(folders: string[], ref: string): Found<string> {
  const r = ref.trim().replace(/^\/+|\/+$/g, '')
  if (!r) return { ok: '' }
  const hit = folders.find((f) => f.toLowerCase() === r.toLowerCase())
  return hit !== undefined ? { ok: hit } : { error: `No folder named ${quote(r)}` }
}
