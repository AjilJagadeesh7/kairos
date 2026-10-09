/** Types for the page bubble on a kanban board: computed facts and change plans. */
import type { Board, KanbanTask, Priority } from './kanban.types'
import type { BubbleBaseEnv } from './aiChat.types'

export type BoardBubbleAction = 'board_summary' | 'board_plan' | 'board_question'

/** Router output for a free-text message in the board bubble. */
export type BoardIntent = { kind: 'summarize' } | { kind: 'change' } | { kind: 'question' }

// ── Facts (computed in code, never by the model) ─────────────────────────────

export interface FactCard {
  key: string
  title: string
  column: string
  /** YYYY-MM-DD */
  due?: string
  /** Why a card counts as blocked. */
  why?: string
  /** Global chat: which card on which board, for source chips. */
  id?: string
  boardId?: string
  board?: string
}

/** A capped list plus its true size, so long lists never distort the count. */
export interface FactList {
  count: number
  cards: FactCard[]
}

export interface BoardColumnFact {
  name: string
  /** Top-level cards — the number on the column header. */
  cards: number
  /** Sub-issues sitting in this column (shown inside their parent card). */
  subIssues: number
  isDone: boolean
  wipLimit?: number
  overWipLimit?: boolean
}

export interface BoardFacts {
  board: string
  /** YYYY-MM-DD, local time. */
  today: string
  /** Every issue, sub-issues included — the Summary tab's "Total". */
  totalIssues: number
  topLevelCards: number
  openIssues: number
  doneIssues: number
  columns: BoardColumnFact[]
  overdue: FactList
  /** Not done, due today or in the next 7 days. */
  dueSoon: FactList
  blocked: FactList
  /** Open issues with priority urgent or high. */
  highPriorityOpen: number
  activeSprint: { name: string; issues: number; done: number; endDate?: string } | null
}

// ── Plans (proposed changes the user confirms) ───────────────────────────────

export type PlanTool = 'create_card' | 'update_card' | 'move_card'

export type CardPatch = Partial<Pick<KanbanTask, 'title' | 'description' | 'due' | 'tags' | 'priority'>>

export interface FieldChange {
  field: 'column' | 'title' | 'description' | 'due' | 'tags' | 'priority' | 'board' | 'body' | 'folder' | 'link' | 'source note'
  before: string
  after: string
}

/** A validated action, in terms of real ids. Only these are ever executed. */
export type ResolvedAction =
  | { tool: 'create_card'; columnId: string; title: string; description?: string; due?: string; tags: string[]; priority: Priority | null; linkedNotes?: string[] }
  | { tool: 'update_card'; taskId: string; patch: CardPatch }
  | { tool: 'move_card'; taskId: string; toColumnId: string }

export interface PlanAction {
  id: string
  /** The tool the model called (may be unknown to us). */
  tool: string
  /** One line for the plan card, e.g. `Move "Fix login" → Done`. */
  summary: string
  /** Exact field changes, shown under the expand control. */
  changes: FieldChange[]
  resolved: ResolvedAction | null
  /** Set when validation failed: shown greyed with this reason, never executed. */
  unresolved?: string
}

export type PlanState = 'pending' | 'applied' | 'cancelled' | 'undone'

export interface BoardPlan {
  actions: PlanAction[]
  /** Ids of the actions whose checkbox is on. */
  selected: string[]
  state: PlanState
  /** How many actions ran on Apply. */
  appliedCount?: number
  /** Actions skipped at Apply because the board changed since the plan (id → reason). */
  skipped?: Record<string, string>
  /** True during the 10-second Undo window after Apply. */
  undoable?: boolean
}

/** What it takes to revert one applied plan. */
export interface BatchUndo {
  created: string[]
  moved: Array<{ taskId: string; fromColumnId: string; fromOrder: number; toColumnId: string }>
  updated: Array<{ taskId: string; before: CardPatch; after: CardPatch }>
  addedBoardTags: string[]
}

/** What every board-bubble action runner gets. */
export interface BoardBubbleEnv extends BubbleBaseEnv {
  /** The live board, read at call time. */
  board: () => Board
  now: () => Date
}

export interface PlanHandlers {
  toggle: (messageId: string, actionId: string) => void
  apply: (messageId: string) => void
  cancel: (messageId: string) => void
  undo: (messageId: string) => void
}
