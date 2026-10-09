/**
 * What the agent knows before it looks anything up: the boards and their
 * columns, the cards most relevant to the message (all of them when they
 * fit), and the recently edited notes. Small and deterministic; the agent
 * reads more with tools. Everything listed here may be named in a proposal.
 */
import { boardsOverview, cardListing } from './globalContext'
import type { AgentState } from './agentTools'
import type { VaultSnapshot } from '../../types'

const RECENT_NOTES = 15

export function agentContext(vault: VaultSnapshot, message: string, cardTokens: number, s: AgentState): string {
  const cards = cardListing(vault.boards, message, cardTokens)
  cards.ids.forEach((id) => s.allowed.cards.add(id))
  for (const b of vault.boards) {
    for (const t of b.tasks) if (s.allowed.cards.has(t.id)) s.untrusted.push({ label: t.key, text: `${t.title}\n${t.description ?? ''}` })
  }
  const recent = [...vault.notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, RECENT_NOTES)
  recent.forEach((n) => s.allowed.notes.add(n.id))
  const journalDays = vault.journal.length
  return [
    `Vault: ${vault.notes.length} note${vault.notes.length === 1 ? '' : 's'}, ${journalDays} journal day${journalDays === 1 ? '' : 's'}, ${vault.boards.length} board${vault.boards.length === 1 ? '' : 's'}.`,
    boardsOverview(vault.boards),
    vault.boards.length ? cards.text : '',
    recent.length
      ? `Recently edited notes (read them with read_note):\n${recent.map((n) => `- "${n.title}" (id=${n.id}, updated ${n.updatedAt.slice(0, 10)}${n.tags.length ? `, tags ${n.tags.join(', ')}` : ''})`).join('\n')}`
      : 'No notes yet.',
  ].filter(Boolean).join('\n\n')
}
