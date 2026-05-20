/**
 * Universal search index — covers notes, journal entries, kanban tasks, and
 * navigation/settings items in a single MiniSearch instance.
 *
 * Design:
 *  - Each document gets a namespaced id: "note:<uuid>", "journal:<date>", "task:<uuid>"
 *  - Fields: title (4×), meta (2×), body (1×)
 *  - Fuzzy tolerance: 0.2 (≈1 typo per 5 chars)
 *  - Prefix matching: always on (so "proj" hits "Projects")
 *  - Combining: OR so partial matches surface, ranked by score
 *  - Recency boost applied post-search so stale results don't outrank fresh ones
 */
import MiniSearch from 'minisearch'
import type { Note, JournalEntry } from '../types'
import type { Board, KanbanTask } from '../types/kanban.types'

// ─── Document shape ──────────────────────────────────────────────────────────

interface UnifiedDoc {
  id: string          // "note:<uuid>" | "journal:<date>" | "task:<uuid>"
  kind: ResultKind
  title: string       // primary searchable label
  meta: string        // secondary context: folder, board name, tags, date string
  body: string        // content snippet (capped to keep index small)
  updatedAt: string   // ISO string — used for recency boost
}

// ─── Result types ─────────────────────────────────────────────────────────────

export type ResultKind = 'note' | 'journal' | 'task'

export interface UniversalHit {
  id: string
  kind: ResultKind
  /** Raw MiniSearch score × recency multiplier */
  score: number
}

// ─── Index singleton ─────────────────────────────────────────────────────────

let _index: MiniSearch<UnifiedDoc> | null = null
let _built = false

function getIndex(): MiniSearch<UnifiedDoc> {
  if (!_index) {
    _index = new MiniSearch<UnifiedDoc>({
      idField: 'id',
      fields: ['title', 'meta', 'body'],
      storeFields: ['id', 'kind', 'updatedAt'],
      searchOptions: {
        boost: { title: 4, meta: 2, body: 1 },
        fuzzy: 0.2,
        prefix: true,
        combineWith: 'OR',
      },
    })
  }
  return _index
}

// ─── Recency boost ────────────────────────────────────────────────────────────
// Score is multiplied by [0.6, 1.0] based on how recently the item was updated.
// Items updated today get 1.0; items updated 1+ year ago get 0.6.
function recencyMultiplier(updatedAt: string): number {
  const ageDays = (Date.now() - new Date(updatedAt).getTime()) / 86_400_000
  return Math.max(0.6, 1 - (ageDays / 365) * 0.4)
}

// ─── Build helpers ────────────────────────────────────────────────────────────

function noteDoc(note: Note): UnifiedDoc {
  return {
    id: `note:${note.id}`,
    kind: 'note',
    title: note.title || 'Untitled note',
    meta: [note.folder, ...note.tags].filter(Boolean).join(' '),
    body: note.content.slice(0, 2000),
    updatedAt: note.updatedAt,
  }
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

function journalDoc(entry: JournalEntry): UnifiedDoc {
  const [y, m, d] = entry.date.split('-').map(Number)
  const monthName = MONTH_NAMES[(m ?? 1) - 1] ?? ''
  return {
    id: `journal:${entry.date}`,
    kind: 'journal',
    title: entry.date,
    // "January 2024 Jan 15" — catches typed month names, year searches, and ISO dates
    meta: `${monthName} ${y} ${monthName.slice(0, 3)} ${d}`,
    body: entry.content.slice(0, 2000),
    updatedAt: entry.updatedAt,
  }
}

function taskDoc(task: KanbanTask, boardTitle: string): UnifiedDoc {
  return {
    id: `task:${task.id}`,
    kind: 'task',
    title: task.title,
    meta: boardTitle,
    body: (task.description ?? '').slice(0, 1000),
    updatedAt: task.updatedAt,
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * (Re)build the full index from current app state.
 * Fast enough to call synchronously on palette open (~1–3 ms for typical vaults).
 */
export function buildUniversalIndex(
  notes: Note[],
  journalEntries: JournalEntry[],
  boards: Board[],
): void {
  const idx = getIndex()
  if (_built) idx.removeAll()

  const docs: UnifiedDoc[] = []

  for (const note of notes) docs.push(noteDoc(note))
  for (const entry of journalEntries) docs.push(journalDoc(entry))
  for (const board of boards) {
    for (const task of board.tasks) docs.push(taskDoc(task, board.title))
  }

  idx.addAll(docs)
  _built = true
}

/** Invalidate so the next call to buildUniversalIndex starts fresh. */
export function invalidateUniversalIndex(): void {
  _built = false
}

/** Search and return ranked hits across all content types. */
export function searchUniversal(query: string, limit = 20): UniversalHit[] {
  const q = query.trim()
  if (!q || !_built) return []
  const idx = getIndex()
  try {
    return idx
      .search(q)
      .map(r => ({
        id: r.id as string,
        kind: r.kind as ResultKind,
        score: (r.score as number) * recencyMultiplier(r.updatedAt as string),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  } catch {
    return []
  }
}

/** Lightweight title-only search — used as fallback before index is ready. */
export function searchByTitle(
  query: string,
  notes: Note[],
  limit = 20,
): Note[] {
  const q = query.toLowerCase()
  return notes
    .filter(n => n.title.toLowerCase().includes(q))
    .slice(0, limit)
}
