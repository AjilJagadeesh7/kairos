/** Types for the global chat: vault facts, the semantic index, retrieval, sources. */
import type { AiChatSource, BubbleBaseEnv } from './aiChat.types'
import type { FactList } from './boardBubble.types'
import type { Board } from './kanban.types'
import type { JournalEntry } from './journal.types'
import type { Note } from './note.types'
import type { WebAccess } from './web.types'

export type ReviewPeriod = 'day' | 'week' | 'month'

/** A note, journal entry or card an answer drew from — shown as a tappable chip. */
export interface ChatSourceRef {
  kind: 'note' | 'journal' | 'card' | 'web'
  /** Note id, journal date, card id, or (web) the page URL. */
  id: string
  boardId?: string
  title: string
  /** Citation number used in the answer ([1], [2]…), when there is one. */
  n?: number
}

// ── Facts (computed in code) ─────────────────────────────────────────────────

export interface NoteRef { id: string; kind: 'note' | 'journal'; title: string }

export interface NoteOpenItems extends NoteRef {
  open: number
  /** The first few unchecked items, verbatim. */
  items: string[]
}

export interface PendingFacts {
  kind: 'pending'
  today: string
  /** Last day of this week (Sunday), YYYY-MM-DD. */
  weekEnd: string
  overdue: FactList
  dueThisWeek: FactList
  /** Open cards across all boards, sub-issues included. */
  openCards: number
  notesWithOpenItems: { count: number; openItems: number; notes: NoteOpenItems[] }
}

export interface ReviewFacts {
  kind: 'review'
  period: ReviewPeriod
  /** First day of the period, YYYY-MM-DD (local). */
  since: string
  today: string
  notesCreated: { count: number; notes: NoteRef[] }
  /** Edited in the period but created before it. */
  notesEdited: { count: number; notes: NoteRef[] }
  journalEntries: { count: number; notes: NoteRef[] }
  cardsCreated: FactList
  cardsCompleted: FactList
  cardsMoved: FactList
  overdueNow: number
}

export type VaultFacts = PendingFacts | ReviewFacts

// ── Semantic index ───────────────────────────────────────────────────────────

/** Where vectors come from: the on-device model, a provider's embeddings endpoint, or none. */
export type IndexSource = 'on-device' | 'provider' | 'keyword'

export interface IndexChunk {
  /** `${kind}:${docId}#${n}` */
  id: string
  docId: string
  kind: 'note' | 'journal'
  title: string
  /** Heading path, e.g. "Plan › Risks". */
  heading: string
  text: string
  tags: string[]
  updatedAt: string
  /** Hash of the whole document's indexed text; a changed hash re-embeds it. */
  hash: string
  /** Absent in keyword-only mode. */
  vector?: Float32Array
  modelId?: string
}

export interface RetrievedChunk extends Omit<IndexChunk, 'vector'> {
  score: number
}

export interface RetrieveFilter {
  /** ISO time; only documents updated since. */
  since?: string
  tags?: string[]
}

export interface VaultSnapshot {
  notes: Note[]
  journal: JournalEntry[]
  boards: Board[]
  /** Folder paths that exist (for create_note). */
  folders?: string[]
}

export type ChatRetention = 'keep' | '30d' | 'never'

/** What every global-chat runner gets. */
export interface GlobalEnv extends BubbleBaseEnv {
  vault: () => VaultSnapshot
  now: () => Date
  retrieve: (query: string, filter: RetrieveFilter) => Promise<{ chunks: RetrievedChunk[]; mode: 'hybrid' | 'keyword' }>
  /** Web search / fetch (P7): null unless web access is on. Requests wait for the user's approval when asked to. */
  web: WebAccess | null
  /** A chat continued from a page bubble: the note or board it was about. */
  focus?: AiChatSource | null
}
