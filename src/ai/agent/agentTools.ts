/**
 * The agent's read tools, run in code against the vault (and the web, with
 * the user's approval). Every note, journal day and web page they return
 * gets a source number the answer cites; every card and note they show
 * joins `allowed`, so a later `propose_changes` may name it.
 */
import { estimateTokens } from '../text/tokens'
import { doneColumnId } from '../../utils/kanban'
import { dueDay } from './boardFacts'
import { cardListing } from './globalContext'
import { resolveBoard, resolveNote } from './globalResolve'
import { computePendingFacts, computeReviewFacts, factSources, periodStart } from './vaultFacts'
import { runWebTool } from './webActions'
import type { AllowedIds, ChatSourceRef, GlobalEnv, ReviewPeriod, ToolCall, VaultFacts, VaultSnapshot } from '../../types'

const PERIODS: ReviewPeriod[] = ['day', 'week', 'month']
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter(Boolean).map((t) => t.replace(/^#/, '')) : [])

/** Numbered sources, in the order they were first read. */
export class SourceRegistry {
  private readonly list: ChatSourceRef[] = []
  add(ref: Omit<ChatSourceRef, 'n'>): number {
    const hit = this.list.find((s) => s.kind === ref.kind && s.id === ref.id)
    if (hit) return hit.n!
    const n = this.list.length + 1
    this.list.push({ ...ref, n })
    return n
  }
  all(): ChatSourceRef[] { return [...this.list] }
}

export interface AgentState {
  allowed: AllowedIds
  sources: SourceRegistry
  /** Facts the answer shows as a card (the last vault_facts call). */
  facts: VaultFacts | null
  /** Text read for this request that may carry planted instructions (checked before a plan). */
  untrusted: Array<{ label: string; text: string }>
  /** One line per step, for the answer's meta line. */
  steps: string[]
}

export function newAgentState(): AgentState {
  return { allowed: { cards: new Set(), notes: new Set() }, sources: new SourceRegistry(), facts: null, untrusted: [], steps: [] }
}

/** The first `maxTokens` of `text`, saying plainly when it was cut. */
function within(text: string, maxTokens: number): string {
  if (estimateTokens(text) <= maxTokens) return text
  let out = ''
  for (const w of text.split(/(\s+)/)) {
    if (estimateTokens(out + w) > maxTokens) break
    out += w
  }
  return `${out}\n[… cut: the rest didn't fit. Search for a specific part instead.]`
}

async function searchNotes(call: ToolCall, env: GlobalEnv, s: AgentState, maxTokens: number): Promise<string> {
  const query = str(call.args.query)
  const since = PERIODS.includes(call.args.since as ReviewPeriod) ? periodStart(call.args.since as ReviewPeriod, env.now()).toISOString() : undefined
  const found = await env.retrieve(query, { since, tags: strings(call.args.tags) })
  s.steps.push(`searched notes for “${query}”`)
  const parts: string[] = []
  let used = 0
  for (const c of found.chunks) {
    const n = s.sources.add({ kind: c.kind, id: c.docId, title: c.title })
    if (c.kind === 'note') s.allowed.notes.add(c.docId)
    const entry = `[${n}] ${c.title}${c.heading ? ` › ${c.heading}` : ''} (${c.kind === 'note' ? `note id=${c.docId}` : `journal ${c.docId}`}, updated ${c.updatedAt.slice(0, 10)})\n${c.text}`
    if (used + estimateTokens(entry) > maxTokens) break
    used += estimateTokens(entry)
    parts.push(entry)
    s.untrusted.push({ label: c.kind === 'note' ? `"${c.title}"` : `journal ${c.docId}`, text: c.text })
  }
  return parts.length ? parts.join('\n\n') : `No notes matched “${query}”.`
}

function readNote(call: ToolCall, vault: VaultSnapshot, s: AgentState, maxTokens: number): string {
  const ref = str(call.args.note)
  const day = vault.journal.find((j) => j.date === ref)
  if (day) {
    const n = s.sources.add({ kind: 'journal', id: day.date, title: `Journal ${day.date}` })
    s.steps.push(`read journal ${day.date}`)
    s.untrusted.push({ label: `journal ${day.date}`, text: day.content })
    return within(`[${n}] Journal ${day.date}\n${day.content}`, maxTokens)
  }
  const found = resolveNote(vault.notes, ref, null)
  if ('error' in found) return found.error
  const note = found.ok
  const n = s.sources.add({ kind: 'note', id: note.id, title: note.title })
  s.allowed.notes.add(note.id)
  s.steps.push(`read “${note.title}”`)
  s.untrusted.push({ label: `"${note.title}"`, text: `${note.title}\n${note.content}` })
  return within(`[${n}] ${note.title} (note id=${note.id}${note.folder ? `, folder ${note.folder}` : ''}, updated ${note.updatedAt.slice(0, 10)})\n${note.content}`, maxTokens)
}

function listCards(call: ToolCall, vault: VaultSnapshot, s: AgentState, maxTokens: number): string {
  const a = call.args
  let boards = vault.boards
  if (str(a.board)) {
    const b = resolveBoard(boards, str(a.board))
    if ('error' in b) return b.error
    boards = [b.ok]
  }
  const column = str(a.column).toLowerCase()
  const before = str(a.dueBefore)
  const tags = strings(a.tags).map((t) => t.toLowerCase())
  const listed = cardListing(boards, '', maxTokens, (t, b) => {
    if (column && b.columns.find((c) => c.id === t.columnId)?.title.trim().toLowerCase() !== column) return false
    if (a.open === true && t.columnId === doneColumnId(b)) return false
    if (before && !(dueDay(t.due) && dueDay(t.due)! < before)) return false
    if (tags.length && !tags.some((tag) => t.tags.some((x) => x.toLowerCase() === tag))) return false
    return true
  })
  listed.ids.forEach((id) => s.allowed.cards.add(id))
  for (const b of boards) for (const t of b.tasks) if (listed.ids.includes(t.id)) s.untrusted.push({ label: t.key, text: `${t.title}\n${t.description ?? ''}` })
  s.steps.push(`listed ${listed.listed} card${listed.listed === 1 ? '' : 's'}${str(a.board) ? ` on ${str(a.board)}` : ''}`)
  return listed.text
}

function vaultFacts(call: ToolCall, env: GlobalEnv, s: AgentState): string {
  const vault = env.vault()
  const facts = call.args.kind === 'review'
    ? computeReviewFacts(vault, PERIODS.includes(call.args.period as ReviewPeriod) ? call.args.period as ReviewPeriod : 'week', env.now())
    : computePendingFacts(vault, env.now())
  s.facts = facts
  for (const src of factSources(facts)) {
    s.sources.add({ kind: src.kind, id: src.id, title: src.title, boardId: src.boardId })
    if (src.kind === 'card') s.allowed.cards.add(src.id)
    if (src.kind === 'note') s.allowed.notes.add(src.id)
  }
  s.steps.push(facts.kind === 'pending' ? 'checked what\'s pending' : `reviewed the ${facts.period}`)
  return `Facts computed by the app (exact; the user sees them as a card — use only these numbers):\n${JSON.stringify(facts)}`
}

async function webTool(call: ToolCall, env: GlobalEnv, s: AgentState, maxTokens: number): Promise<string> {
  if (!env.web) return 'Web access is off.'
  const out = await runWebTool(call, env.web)
  s.steps.push(`${call.name === 'web_search' ? 'searched the web for' : 'read'} ${call.name === 'web_search' ? `“${str(call.args.query)}”` : str(call.args.url)}${out.declined ? ' (not allowed)' : ''}`)
  if (!out.finds.length) return out.text
  const parts = out.finds.map((f) => {
    const n = s.sources.add({ kind: 'web', id: f.url, title: f.title })
    s.untrusted.push({ label: 'a web page', text: f.text })
    return `[${n}] ${f.title} — ${f.url}\n${f.text}`
  })
  return within(parts.join('\n\n'), maxTokens)
}

/** Runs one read tool; `maxTokens` caps what it returns. Failures come back as text for the model. */
export async function runAgentTool(call: ToolCall, env: GlobalEnv, s: AgentState, maxTokens: number): Promise<string> {
  try {
    switch (call.name) {
      case 'search_notes': return await searchNotes(call, env, s, maxTokens)
      case 'read_note': return readNote(call, env.vault(), s, maxTokens)
      case 'list_cards': return listCards(call, env.vault(), s, maxTokens)
      case 'vault_facts': return vaultFacts(call, env, s)
      case 'web_search':
      case 'fetch_url': return await webTool(call, env, s, maxTokens)
      default: return `"${call.name}" is not a tool you can use.`
    }
  } catch (err) {
    return `${call.name} failed: ${(err as Error).message}`
  }
}
