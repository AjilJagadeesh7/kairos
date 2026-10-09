/**
 * Applies a confirmed global plan, and reverts it, through a `VaultWriter`
 * the caller implements with the existing stores — this file never touches
 * storage. Order: new notes, then links (which may point at them), then each
 * board as one write. Undo runs in reverse and only undoes what is still as
 * the plan left it.
 */
import { applyPlan, revertPlan } from './boardApply'
import type { Board, GlobalPlanAction, GlobalUndo, Note, PlanAction } from '../../types'

export interface VaultWriter {
  boards(): Board[]
  /** Commits a board as one write (one board-history entry). */
  commitBoard(boardId: string, next: Board): void
  notes(): Note[]
  createNote(note: { title: string; content: string; folder?: string }): Promise<string>
  setNoteContent(noteId: string, content: string): Promise<void>
  /** Soft delete: the note goes to the trash. */
  trashNote(noteId: string): Promise<void>
}

export interface GlobalApplyResult {
  applied: number
  skipped: Record<string, string>
  undo: GlobalUndo
  /** Board titles and note titles changed, for the Undo toast. */
  touched: string[]
}

/** The note body after appending `[[title]]`, the same way `appendWikilink` does. */
export function withLink(content: string, title: string): string {
  const base = content.trimEnd()
  return `${base}${base ? '\n\n' : ''}[[${title}]]`
}

export async function applyGlobalPlan(actions: GlobalPlanAction[], w: VaultWriter, now = new Date()): Promise<GlobalApplyResult> {
  const undo: GlobalUndo = { boards: [], notesCreated: [], links: [] }
  const skipped: Record<string, string> = {}
  const touched = new Set<string>()
  const created = new Map<string, string>()
  let applied = 0

  for (const a of actions) {
    const r = a.resolved
    if (r?.kind !== 'create_note') continue
    if (w.notes().some((n) => n.title.trim().toLowerCase() === r.title.toLowerCase())) {
      skipped[a.id] = 'A note with this title exists now'
      continue
    }
    const id = await w.createNote({ title: r.title, content: r.body, folder: r.folder })
    created.set(r.title.toLowerCase(), id)
    undo.notesCreated.push({ id, title: r.title, content: r.body })
    touched.add(`"${r.title}"`)
    applied++
  }

  for (const a of actions) {
    const r = a.resolved
    if (r?.kind !== 'link_notes') continue
    const id = 'id' in r.from ? r.from.id : created.get(r.from.newTitle.toLowerCase())
    const note = id ? w.notes().find((n) => n.id === id) : undefined
    if (!note) { skipped[a.id] = 'That note no longer exists'; continue }
    if (note.content.toLowerCase().includes(`[[${r.toTitle.toLowerCase()}]]`)) { skipped[a.id] = 'Already linked'; continue }
    const after = withLink(note.content, r.toTitle)
    await w.setNoteContent(note.id, after)
    // A note this plan created is removed whole on Undo; only links in existing notes are undone one by one.
    const fresh = undo.notesCreated.find((c) => c.id === note.id)
    if (fresh) fresh.content = after
    else undo.links.push({ noteId: note.id, title: note.title, before: note.content, after })
    touched.add(`"${note.title}"`)
    applied++
  }

  // Each board's actions run as one batch through the board bubble's executor.
  const byBoard = new Map<string, PlanAction[]>()
  for (const a of actions) {
    const r = a.resolved
    if (r?.kind !== 'card') continue
    byBoard.set(r.boardId, [...(byBoard.get(r.boardId) ?? []), { ...a, resolved: r.action }])
  }
  for (const [boardId, list] of byBoard) {
    const board = w.boards().find((b) => b.id === boardId)
    if (!board) { for (const a of list) skipped[a.id] = 'That board no longer exists'; continue }
    const result = applyPlan(board, list, now)
    Object.assign(skipped, result.skipped)
    if (!result.applied) continue
    w.commitBoard(boardId, result.board)
    undo.boards.push({ boardId, undo: result.undo })
    touched.add(board.title)
    applied += result.applied
  }
  return { applied, skipped, undo, touched: [...touched] }
}

/**
 * Reverts an applied plan. A created note the user has edited since, or a
 * link in a note edited since, is left alone and named in `kept`.
 */
export async function revertGlobalPlan(undo: GlobalUndo, w: VaultWriter, now = new Date()): Promise<{ kept: string[] }> {
  const kept: string[] = []
  for (const u of [...undo.boards].reverse()) {
    const board = w.boards().find((b) => b.id === u.boardId)
    if (!board) continue
    const reverted = revertPlan(board, u.undo, now)
    w.commitBoard(u.boardId, reverted.board)
    kept.push(...reverted.kept)
  }
  for (const l of [...undo.links].reverse()) {
    const note = w.notes().find((n) => n.id === l.noteId)
    if (!note) continue
    if (note.content === l.after) await w.setNoteContent(l.noteId, l.before)
    else kept.push(`the link in "${l.title}"`)
  }
  for (const c of [...undo.notesCreated].reverse()) {
    const note = w.notes().find((n) => n.id === c.id)
    if (!note) continue
    if (note.content === c.content && note.title === c.title) await w.trashNote(c.id)
    else kept.push(`"${c.title}"`)
  }
  return { kept }
}
