/** Types for global-chat writes (P5): multi-step plans across boards and notes. */
import type { BatchUndo, FieldChange, PlanState, ResolvedAction } from './boardBubble.types'

/** A validated global action, in terms of real ids. Only these are ever executed. */
export type GlobalResolved =
  | { kind: 'card'; boardId: string; action: ResolvedAction }
  | { kind: 'create_note'; title: string; body: string; folder?: string }
  /** `from`: an existing note's id, or the title of a note this plan creates. */
  | { kind: 'link_notes'; from: { id: string } | { newTitle: string }; toTitle: string }

export interface GlobalPlanAction {
  id: string
  tool: string
  /** One line for the plan card, e.g. `Move REL-2 "Ship v2" → Done (Release)`. */
  summary: string
  changes: FieldChange[]
  resolved: GlobalResolved | null
  /** Set when validation failed: shown greyed with this reason, never executed. */
  unresolved?: string
}

export interface GlobalPlan {
  actions: GlobalPlanAction[]
  selected: string[]
  state: PlanState
  appliedCount?: number
  /** Actions skipped at Apply because the vault changed since the plan (id → reason). */
  skipped?: Record<string, string>
  undoable?: boolean
  /** Set when text read for this plan addresses an AI; the plan then starts with nothing selected. */
  warning?: string
}

/** What the model was shown in one change request: only these may appear in actions. */
export interface AllowedIds {
  cards: Set<string>
  notes: Set<string>
}

/** What it takes to revert one applied global plan. */
export interface GlobalUndo {
  boards: Array<{ boardId: string; undo: BatchUndo }>
  /** Notes the plan created, with the content written, so Undo leaves edited ones alone. */
  notesCreated: Array<{ id: string; title: string; content: string }>
  /** Wikilinks the plan appended; Undo restores `before` only while the note is still `after`. */
  links: Array<{ noteId: string; title: string; before: string; after: string }>
}
