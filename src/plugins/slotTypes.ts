import type React from 'react'
import type { NoteView } from './types'

// ─── Slot IDs ─────────────────────────────────────────────────────────────────
// Named extension points across the app. Each slot is a position where plugins
// can inject React components. The host renders them in order.

export type SlotId =
  // Notes editor
  | 'editor:toolbar:start'
  | 'editor:toolbar:end'
  | 'editor:title:below'
  // Notes right sidebar — stacked panels below built-in sections
  | 'notes:right-sidebar:panel'
  // Kanban
  | 'kanban:card:footer'
  | 'kanban:toolbar:end'
  // Canvas
  | 'canvas:toolbar:end'
  // Journal
  | 'journal:header:end'
  | 'journal:sidebar:panel'
  // Left sidebar
  | 'sidebar:header:end'
  | 'sidebar:footer'
  // Activity bar (bottom)
  | 'activity-bar:bottom'
  // App-wide
  | 'layout:status-bar'
  | 'settings:sidebar:end'

// ─── Slot context props ───────────────────────────────────────────────────────
// Each registered component receives these props from the host.

export interface EditorSlotProps       { noteId: string; noteTitle: string }
export interface NoteSlotProps         { note: NoteView }
export interface KanbanCardSlotProps   { taskId: string; boardId: string }
export interface KanbanBoardSlotProps  { boardId: string }
export interface CanvasSlotProps       { canvasId: string }
export interface JournalSlotProps      { date: string }
export type     EmptySlotProps         = Record<string, never>

export interface SlotPropsMap {
  'editor:toolbar:start':      EditorSlotProps
  'editor:toolbar:end':        EditorSlotProps
  'editor:title:below':        EditorSlotProps
  'notes:right-sidebar:panel': NoteSlotProps
  'kanban:card:footer':        KanbanCardSlotProps
  'kanban:toolbar:end':        KanbanBoardSlotProps
  'canvas:toolbar:end':        CanvasSlotProps
  'journal:header:end':        JournalSlotProps
  'journal:sidebar:panel':     JournalSlotProps
  'sidebar:header:end':        EmptySlotProps
  'sidebar:footer':            EmptySlotProps
  'activity-bar:bottom':       EmptySlotProps
  'layout:status-bar':         EmptySlotProps
  'settings:sidebar:end':      EmptySlotProps
}

// ─── Slot registration record ─────────────────────────────────────────────────

export interface SlotRegistration<S extends SlotId = SlotId> {
  pluginId: string
  slot: S
  component: React.ComponentType<SlotPropsMap[S]>
  order?: number  // lower = rendered first; default 50
}
