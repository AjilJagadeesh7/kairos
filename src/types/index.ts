export type { Note, TagRecord, NoteTemplate } from './note.types'
export type {
  SyncStatus, SyncProviderType, StorageTarget, SyncMeta,
  SyncCategory, SyncDirection, SyncRules, SyncProviderId, SyncProviderMeta,
} from './sync.types'
export { SYNC_CATEGORIES, SYNC_PROVIDERS, SYNC_PROVIDER_META, DEFAULT_SYNC_RULES } from './sync.types'
export type { ThemeMode, SearchMode, FontOption, FontWeight, VaultStatus } from './ui.types'
export type {
  SaveStatus,
  MenuKind,
  ContextMenuState,
  EditorDraftProps,
  MarkdownEditorProps,
  TableCommandRunner,
} from './editor.types'
export { CLOSED_MENU } from './editor.types'
export type { Stroke, StrokePoint } from './pen.types'
export type { Annotation } from './annotation.types'
export { ANNOTATION_COLORS } from './annotation.types'
export type { PenNote, PenStroke, PenTool, PenNoteVersion } from './penNote.types'
export { PEN_COLORS, HIGHLIGHTER_COLORS, PEN_SIZES, HIGHLIGHTER_SIZE, AUTO_INK } from './penNote.types'
export type { EdgeKind, GraphEdge, GNode, GLink, GraphPopover, GraphMode, RightClickTarget } from './graph.types'
export type { Section, CustomCallout } from './settings.types'
export type { SettingRecord, EmbeddingRecord } from './db.types'
export type { Attachment, AttachmentMeta, AttachmentKind } from './attachment.types'
export type { JournalEntry } from './journal.types'
export type { Canvas, CanvasNode, CanvasEdge, CanvasNodeType, CanvasNodeData, CanvasTextData, CanvasNoteData, CanvasWebData } from './canvas.types'
export type { ContentVersion, VersionHistory } from './history.types'
export type { KairosTier, TierLimits, StorageBreakdown, StorageUsage, UpgradeReason } from './tier.types'
export type { FrontmatterFieldType, FrontmatterField, FrontmatterPanelMode } from './frontmatter.types'
export type {
  Board,
  KanbanColumn,
  KanbanTask,
  KanbanTag,
  KanbanFilters,
  Subtask,
  Checkpoint,
  Priority,
  DueFilter,
  SortMode,
  IssueType,
  KanbanView,
  BoardGroupBy,
  Sprint,
  SprintStatus,
} from './kanban.types'
