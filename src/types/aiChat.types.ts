/** Types for AI conversations: the page bubble, saved chat history, and the
 *  editor bridge the bubble uses to preview and apply suggestions. */
import type { LLMProvider, Msg, ProviderLocation, TokenUsage } from './ai.types'
import type { BoardBubbleAction, BoardFacts, BoardPlan } from './boardBubble.types'

export type RewriteStyle = 'shorter' | 'formal' | 'casual' | 'grammar'

export type NoteBubbleAction =
  | 'summarize' | 'rewrite' | 'continue' | 'suggest_title' | 'suggest_tags' | 'question'

export type BubbleAction = NoteBubbleAction | BoardBubbleAction

/** Router output for a free-text message in the note bubble. */
export type NoteIntent =
  | { kind: 'summarize' }
  | { kind: 'rewrite'; style: RewriteStyle }
  | { kind: 'continue' }
  | { kind: 'suggest_title' }
  | { kind: 'suggest_tags' }
  | { kind: 'extract_tasks' }
  | { kind: 'question' }

export type SuggestionState = 'pending' | 'accepted' | 'rejected' | 'stale'

export type BubbleSuggestion =
  | { kind: 'replace'; style: RewriteStyle; original: string; originalText: string; proposed: string; state: SuggestionState }
  | { kind: 'insert'; pos: number; proposed: string; state: SuggestionState }
  | { kind: 'summary'; inserted: boolean }
  | { kind: 'title'; options: string[]; applied: string | null }
  | { kind: 'tags'; options: string[]; applied: string[] | null }

export interface BubbleMessage {
  id: string
  role: 'user' | 'assistant' | 'error' | 'notice'
  content: string
  createdAt: string
  action?: BubbleAction
  streaming?: boolean
  suggestion?: BubbleSuggestion
  /** Board bubble: counts computed in code, rendered as-is above the reply. */
  boardFacts?: BoardFacts
  /** Board bubble: proposed changes awaiting Apply. */
  plan?: BoardPlan
  usage?: TokenUsage
  /** Shown above the content, e.g. "1,240 words · edited 2 days ago". */
  meta?: string
}

/** The note as the bubble sees it: the live draft, not the last save. */
export interface NoteSnapshot {
  id: string
  title: string
  content: string
  tags: string[]
  updatedAt: string
}

/** Where bubble action runners write their output. */
export interface BubbleSink {
  add(message: BubbleMessage): void
  patch(id: string, update: (m: BubbleMessage) => BubbleMessage): void
  progress(text: string | null): void
}

/** Text after map-reduce condensing (or unchanged, when it already fit). */
export interface Condensed {
  text: string
  /** False when the input already fit and is returned unchanged. */
  condensed: boolean
  /** How many parts the original was split into (1 when not condensed). */
  parts: number
}

/** What every bubble action runner gets, on any page type. */
export interface BubbleBaseEnv {
  provider: LLMProvider
  /** Prompt-token budget of one request. */
  budget: number
  sink: BubbleSink
  isStopped: () => boolean
  /** Earlier question/answer turns in this bubble session. */
  history: () => Msg[]
  /** Condensed pages for this session, so a second action doesn't redo map-reduce. */
  cache: Map<string, Condensed>
}

/** What every note-bubble action runner gets. */
export interface BubbleEnv extends BubbleBaseEnv {
  /** The live note (draft), read at call time. */
  note: () => NoteSnapshot
  /** Tag names already used in the vault, offered to "suggest tags". */
  vocabulary: string[]
  bridge: NoteEditorBridge
}

/** Runs one bubble action with a provider; `userText` is echoed as the user's turn. */
export type BubbleRun<E = BubbleEnv> = (userText: string | null, job: (env: E) => Promise<void>) => Promise<void>

export interface UseNoteBubbleParams {
  /** The live draft, read at call time. */
  note: () => NoteSnapshot
  bridge: NoteEditorBridge
  vocabulary: () => string[]
  onApplyTitle: (title: string) => void
  onApplyTags: (tags: string[]) => void
}

/** What the user can do with a suggestion in the bubble. */
export interface SuggestionHandlers {
  accept: (id: string) => void
  reject: (id: string) => void
  retry: (id: string) => void
  insertSummary: (id: string) => void
  applyTitle: (id: string, title: string) => void
  applyTags: (id: string, tags: string[]) => void
}

// ── Saved chat history ───────────────────────────────────────────────────────

export interface AiChatMessage {
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  action?: BubbleAction
  /** What the user did with a suggestion: accepted, rejected, inserted, applied. */
  outcome?: string
}

export interface AiChatSource {
  kind: 'note' | 'board'
  id: string
  title: string
}

export interface AiChatRecord {
  id: string
  surface: 'bubble' | 'global'
  /** e.g. "Bubble · Meeting notes 12 Oct". */
  title: string
  /** The page a bubble ran on. Kept for the chat page and the future graph view. */
  source: AiChatSource | null
  /** Conversations attached as context. */
  attachedChatIds: string[]
  provider: { id: string; name: string; model: string; location: ProviderLocation } | null
  messages: AiChatMessage[]
  createdAt: string
  updatedAt: string
}

// ── Editor bridge ────────────────────────────────────────────────────────────

export interface EditorRange { from: number; to: number }

export interface EditorSelectionSnapshot extends EditorRange {
  /** The selection serialized as markdown (what the model sees). */
  markdown: string
  /** Plain text, used to detect edits under a pending suggestion. */
  text: string
}

/** What the note bubble needs from the editor. Implemented over ProseMirror. */
export interface NoteEditorBridge {
  /** The document as markdown right now (the draft's copy lags behind typing). */
  markdown(): string | null
  /** The current non-empty selection, or null. */
  selection(): EditorSelectionSnapshot | null
  /** Where "continue" inserts (end of the cursor's block, or `pos` when given)
   *  and the markdown before it. */
  continuePoint(pos?: number): { pos: number; before: string } | null
  /** Strikes `range` and shows `proposed` after it, until cleared. */
  showPreview(range: EditorRange, originalText: string, proposed: string): void
  clearPreview(): void
  /** The previewed range, mapped through edits made since it was shown. */
  previewRange(): EditorRange | null
  /** Replaces the previewed range with `markdown`. */
  applyPreview(markdown: string): 'ok' | 'changed' | 'missing'
  insertAtTop(markdown: string): boolean
}
