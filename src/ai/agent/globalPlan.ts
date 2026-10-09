/**
 * Turns the model's write calls in the global chat into a plan the user
 * confirms. Card actions are validated by the board bubble's own validator
 * on the board they resolve to; notes and links are validated here. Anything
 * that doesn't resolve — including items the model wasn't shown — stays in
 * the plan, greyed with the reason, and is never executed.
 */
import { v4 as uuid } from 'uuid'
import { boardAction, CONFLICT_REASON, conflictKey, MAX_PLAN_ACTIONS } from './boardPlan'
import { findCard, resolveBoard, resolveFolder, resolveNote } from './globalResolve'
import type { AllowedIds, FieldChange, GlobalPlanAction, ToolCall, VaultSnapshot } from '../../types'

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const quote = (s: string) => `"${s.length > 60 ? `${s.slice(0, 59)}…` : s}"`

function unresolved(call: ToolCall, summary: string, reason: string): GlobalPlanAction {
  return { id: uuid(), tool: call.name, summary, changes: [], resolved: null, unresolved: reason }
}

/** Kairos tags are `#words` in the note body: letters, digits, `_` and `-`, 2–50 long. */
export function noteTag(raw: string): string | null {
  const t = raw.trim().replace(/^#+/, '').replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase()
  return t.length >= 2 && t.length <= 50 ? t : null
}

/** The body as written, plus a line of `#tags` for any tag it doesn't already carry. */
export function noteContent(body: string, tags: string[]): string {
  const missing = tags.filter((t) => !new RegExp(`(^|\\s)#${t}(?![\\w-])`, 'i').test(body))
  const text = body.trim()
  return missing.length ? `${text}${text ? '\n\n' : ''}${missing.map((t) => `#${t}`).join(' ')}` : text
}

function cardCall(call: ToolCall, vault: VaultSnapshot, allowed: AllowedIds): GlobalPlanAction {
  const a = call.args
  if (call.name === 'create_card') {
    const board = resolveBoard(vault.boards, str(a.board))
    const draft = `Add ${quote(str(a.title) || 'untitled')} to ${str(a.board) || '?'} › ${str(a.column) || '?'}`
    if ('error' in board) return unresolved(call, draft, board.error)
    const action = boardAction(call, board.ok)
    let linked: string[] | undefined
    const extra: FieldChange[] = [{ field: 'board', before: '—', after: board.ok.title }]
    if (str(a.sourceNoteId)) {
      const note = resolveNote(vault.notes, str(a.sourceNoteId), allowed.notes)
      if ('error' in note) return { ...action, id: uuid(), summary: draft, resolved: null, unresolved: note.error, changes: [] }
      linked = [note.ok.id]
      extra.push({ field: 'source note', before: '—', after: note.ok.title })
    }
    const r = action.resolved
    return {
      ...action,
      summary: action.summary.replace(/ to ([^"]+)$/, ` to ${board.ok.title} › $1`),
      changes: [...extra, ...action.changes],
      resolved: r && r.tool === 'create_card' ? { kind: 'card', boardId: board.ok.id, action: { ...r, linkedNotes: linked } } : null,
    }
  }
  // move_card / update_card: find the card on whichever board has it.
  const ref = str(a.cardId)
  const hit = findCard(vault.boards, ref, str(a.board), allowed.cards)
  const verb = call.name === 'move_card' ? `Move ${quote(ref)} → ${str(a.toColumn) || '?'}` : `Update ${quote(ref)}`
  if ('error' in hit) return unresolved(call, verb, hit.error)
  const action = boardAction({ ...call, args: { ...a, cardId: hit.ok.task.id } }, hit.ok.board)
  return {
    ...action,
    summary: `${action.summary} (${hit.ok.board.title})`,
    resolved: action.resolved ? { kind: 'card', boardId: hit.ok.board.id, action: action.resolved } : null,
  }
}

function noteCall(call: ToolCall, vault: VaultSnapshot, newTitles: Set<string>): GlobalPlanAction {
  const a = call.args
  const title = str(a.title).replace(/\s+/g, ' ')
  const summary = `Create note ${quote(title || 'untitled')}`
  if (!title) return unresolved(call, summary, 'The note has no title')
  const taken = vault.notes.some((n) => n.title.trim().toLowerCase() === title.toLowerCase()) || newTitles.has(title.toLowerCase())
  if (taken) return unresolved(call, summary, `A note named ${quote(title)} already exists — links by title would be ambiguous`)
  const folders = [...new Set([...(vault.folders ?? []), ...vault.notes.map((n) => n.folder ?? '').filter(Boolean)])]
  const folder = resolveFolder(folders, str(a.folder))
  if ('error' in folder) return unresolved(call, summary, folder.error)
  const tags = (Array.isArray(a.tags) ? a.tags : []).map((t) => noteTag(str(t))).filter((t): t is string => !!t)
  const body = noteContent(str(a.body), [...new Set(tags)])
  newTitles.add(title.toLowerCase())
  return {
    id: uuid(), tool: call.name, summary,
    changes: [
      { field: 'title', before: '—', after: title },
      ...(folder.ok ? [{ field: 'folder' as const, before: '—', after: folder.ok }] : []),
      { field: 'body', before: '—', after: body || '(empty)' },
    ],
    resolved: { kind: 'create_note', title, body, folder: folder.ok || undefined },
  }
}

function linkCall(call: ToolCall, vault: VaultSnapshot, allowed: AllowedIds, newTitles: Set<string>): GlobalPlanAction {
  const fromRef = str(call.args.fromNoteId)
  const toRef = str(call.args.toNoteId)
  const draft = `Link ${quote(fromRef || '?')} → ${quote(toRef || '?')}`
  // A note this plan creates can be either end, by its title.
  const planned = (ref: string) => (newTitles.has(ref.replace(/^\[\[|\]\]$/g, '').trim().toLowerCase()) ? ref.replace(/^\[\[|\]\]$/g, '').trim() : null)
  const fromNew = planned(fromRef)
  const from = fromNew ? null : resolveNote(vault.notes, fromRef, allowed.notes)
  if (from && 'error' in from) return unresolved(call, draft, from.error)
  const toNew = planned(toRef)
  const to = toNew ? null : resolveNote(vault.notes, toRef, allowed.notes)
  if (to && 'error' in to) return unresolved(call, draft, to.error)

  const fromTitle = from?.ok.title ?? fromNew!
  const toTitle = to?.ok.title ?? toNew!
  const summary = `Link ${quote(fromTitle)} → ${quote(toTitle)}`
  if (fromTitle.toLowerCase() === toTitle.toLowerCase()) return unresolved(call, summary, 'A note can\'t link to itself')
  if (from && from.ok.content.toLowerCase().includes(`[[${toTitle.toLowerCase()}]]`)) return unresolved(call, summary, 'Already linked')
  return {
    id: uuid(), tool: call.name, summary,
    changes: [{ field: 'link', before: '—', after: `[[${toTitle}]] added at the end of ${quote(fromTitle)}` }],
    resolved: { kind: 'link_notes', from: from ? { id: from.ok.id } : { newTitle: fromNew! }, toTitle },
  }
}

/** Validates every write call. Returns null when the plan is too large (PRD: max 20). */
export function globalPlanFromCalls(calls: ToolCall[], vault: VaultSnapshot, allowed: AllowedIds): GlobalPlanAction[] | null {
  if (calls.length > MAX_PLAN_ACTIONS) return null
  // New notes first, so links can name them wherever they come in the plan.
  const newTitles = new Set<string>()
  const notes = new Map(calls.filter((c) => c.name === 'create_note').map((c) => [c, noteCall(c, vault, newTitles)]))
  const touched = new Set<string>()
  return calls.map((call) => {
    if (notes.has(call)) return notes.get(call)!
    if (call.name === 'link_notes') return linkCall(call, vault, allowed, newTitles)
    if (!['create_card', 'move_card', 'update_card'].includes(call.name)) {
      return unresolved(call, call.name, `"${call.name}" can't be used here`)
    }
    const action = cardCall(call, vault, allowed)
    const key = action.resolved?.kind === 'card' ? conflictKey(action.resolved.action) : null
    if (key) {
      if (touched.has(key)) return { ...action, resolved: null, unresolved: CONFLICT_REASON }
      touched.add(key)
    }
    return action
  })
}
