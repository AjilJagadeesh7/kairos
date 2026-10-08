/** Types for "Turn this into tasks": action items from a note, proposed as cards. */
import type { PlanState } from './boardBubble.types'
import type { Priority } from './kanban.types'

export interface ExtractedTask {
  id: string
  title: string
  /** Stored form (`YYYY-MM-DDT00:00:00.000Z`), only when the note states a date. */
  due?: string
  priority: Priority | null
  /** The note text the item came from — checked in code to exist in the note. */
  quote: string
  /** `checklist`: an unchecked `- [ ]` line, found by code. `model`: found in prose. */
  origin: 'checklist' | 'model'
  /** Set when the item can't be used (not in the note, already done…): greyed, never created. */
  unresolved?: string
}

export interface TaskPlan {
  noteId: string
  noteTitle: string
  tasks: ExtractedTask[]
  /** Ids of the tasks whose checkbox is on. */
  selected: string[]
  /** Target picked in the plan card. */
  boardId: string | null
  columnId: string | null
  state: PlanState
  appliedCount?: number
  /** Board the cards were created on (for Undo). */
  appliedBoardId?: string
  /** Keys of the created cards, e.g. ["KAI-12", "KAI-13"]. */
  createdKeys?: string[]
  undoable?: boolean
}

export interface TaskPlanHandlers {
  toggle: (messageId: string, taskId: string) => void
  setTarget: (messageId: string, boardId: string, columnId: string | null) => void
  apply: (messageId: string) => void
  cancel: (messageId: string) => void
  undo: (messageId: string) => void
}
