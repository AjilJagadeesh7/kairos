import type React from 'react'

// ─── Manifest ─────────────────────────────────────────────────────────────────
export interface PluginManifest {
  id: string            // must match vault folder name
  name: string
  version: string       // semver
  description: string
  author: string
  entryPoint: string    // relative path: "index.js"
  permissions: PluginPermission[]
  minAppVersion?: string
}

export type PluginPermission =
  | 'read:notes'
  | 'write:notes'
  | 'read:kanban'
  | 'write:kanban'
  | 'ui:page'
  | 'ui:settings'
  | 'ui:header'
  | 'events'

// ─── App events plugins can subscribe to ──────────────────────────────────────
export type AppEvent =
  | 'note:created'
  | 'note:updated'
  | 'note:deleted'
  | 'kanban:taskMoved'
  | 'kanban:taskCreated'
  | 'vault:connected'
  | 'app:ready'

// ─── What plugins register ─────────────────────────────────────────────────────
export interface PluginPageRegistration {
  pluginId: string
  path: string                    // e.g. "/pomodoro"
  navLabel: string                // text shown in header
  navIcon?: React.ElementType     // lucide icon component
  component: React.ComponentType
}

export interface PluginSettingsRegistration {
  pluginId: string
  id: string                      // settings section id, e.g. "pomodoro-settings"
  label: string
  icon?: React.ElementType
  component: React.ComponentType
}

export interface PluginRegistry {
  pages: PluginPageRegistration[]
  settings: PluginSettingsRegistration[]
}

// ─── Narrow data types exposed to plugins ────────────────────────────────────
// Plugins receive snapshots, not mutable store references.
// The embedding vector is intentionally excluded — it's large and internal.

export interface NoteListItem {
  id: string
  title: string
  tags: string[]
  updatedAt: string
  createdAt: string
}

export interface NoteView extends NoteListItem {
  content: string
}

export interface NoteWriteData {
  title?: string
  content?: string
  tags?: string[]
}

export interface BoardSummary {
  id: string
  title: string
}

export interface TaskWriteData {
  title?: string
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  due?: string
  tags?: string[]
}

// ─── API object handed to each plugin's setup() ───────────────────────────────
export interface MindVaultPluginAPI {
  readonly pluginId: string
  readonly manifest: PluginManifest

  // UI registration — requires 'ui:page' / 'ui:settings'
  registerPage(reg: Omit<PluginPageRegistration, 'pluginId'>): void
  registerSettingsSection(reg: Omit<PluginSettingsRegistration, 'pluginId'>): void

  // Event bus — requires 'events'
  on(event: AppEvent, handler: (payload: unknown) => void): void
  off(event: AppEvent, handler: (payload: unknown) => void): void
  emit(event: AppEvent, payload?: unknown): void

  // Notes API — 'read:notes' for reads, 'write:notes' for mutations
  notes: {
    list(): NoteListItem[]
    get(id: string): NoteView | null
    create(data: { title: string; content?: string }): Promise<string>
    update(id: string, patch: NoteWriteData): Promise<void>
    delete(id: string): Promise<void>
  }

  // Kanban API — 'read:kanban' for reads, 'write:kanban' for mutations
  kanban: {
    getBoards(): BoardSummary[]
    createTask(boardId: string, columnId: string, title: string): string
    updateTask(boardId: string, taskId: string, updates: TaskWriteData): void
  }

  // Per-plugin file storage inside vault/plugins/{id}/
  readPluginData(filename: string): Promise<string | null>
  writePluginData(filename: string, content: string): Promise<void>

  // Shared UI components and React (so plugins don't bundle them)
  components: typeof import('./sharedComponents')
  React: typeof import('react')
}

export type PluginSetupFn = (api: MindVaultPluginAPI) => void | Promise<void>

export interface PluginModule {
  default: PluginSetupFn
}

// ─── Persisted install record ──────────────────────────────────────────────────
export interface InstalledPlugin {
  id: string
  manifest: PluginManifest
  enabled: boolean
  installedAt: string   // ISO
  source?: string       // marketplace origin URL or 'local'
}

// ─── Install request (used by postMessage + deep link handlers) ────────────────
export interface PluginInstallRequest {
  id: string
  manifestUrl: string
  bundleUrl: string
}
