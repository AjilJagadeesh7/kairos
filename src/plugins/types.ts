import type React from 'react'
import type { IconToken } from '../icons/tokens'
import type { SlotId, SlotPropsMap, SlotRegistration } from './slotTypes'
import type {
  EditorToolbarItem,
  EditorMilkdownPlugin,
  ThemeRegistration,
  CommandRegistration,
  CanvasNodeTypeRegistration,
} from './extensionTypes'

export type { SlotId, SlotPropsMap, SlotRegistration }
export type { EditorToolbarItem, EditorMilkdownPlugin, ThemeRegistration, CommandRegistration, CanvasNodeTypeRegistration }

// ─── Manifest ─────────────────────────────────────────────────────────────────
export interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  author: string
  entryPoint: string
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
  | 'ui:icons'
  | 'ui:slot'
  | 'ui:theme'
  | 'ui:commands'
  | 'editor:extend'
  | 'canvas:extend'
  | 'events'

// ─── Icon rules ───────────────────────────────────────────────────────────────
export interface IconRule {
  titleMatch?: string
  folder?: string
  tag?: string
  emoji: string
  color?: string
}

// ─── App events ───────────────────────────────────────────────────────────────
export type AppEvent =
  | 'note:created'
  | 'note:updated'
  | 'note:deleted'
  | 'kanban:taskMoved'
  | 'kanban:taskCreated'
  | 'vault:connected'
  | 'app:ready'

// ─── UI registrations ─────────────────────────────────────────────────────────
export interface PluginPageRegistration {
  pluginId: string
  path: string
  navLabel: string
  navIcon?: React.ElementType
  navIconName?: IconToken
  component: React.ComponentType
}

export interface PluginSettingsRegistration {
  pluginId: string
  id: string
  label: string
  icon?: React.ElementType
  component: React.ComponentType
}

// ─── Registry ─────────────────────────────────────────────────────────────────
export interface PluginRegistry {
  pages: PluginPageRegistration[]
  settings: PluginSettingsRegistration[]
  iconRules: IconRule[]
  slots: SlotRegistration[]
  themes: ThemeRegistration[]
  commands: CommandRegistration[]
  editorToolbarItems: EditorToolbarItem[]
  editorMilkdownPlugins: EditorMilkdownPlugin[]
  canvasNodeTypes: CanvasNodeTypeRegistration[]
}

// ─── Narrow data types exposed to plugins ────────────────────────────────────
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

// ─── Plugin API ───────────────────────────────────────────────────────────────
export interface KairosPluginAPI {
  readonly pluginId: string
  readonly manifest: PluginManifest

  // ── Pages & settings ──────────────────────────────────────────────────────
  registerPage(reg: Omit<PluginPageRegistration, 'pluginId'>): void
  registerSettingsSection(reg: Omit<PluginSettingsRegistration, 'pluginId'>): void

  // ── Icons ─────────────────────────────────────────────────────────────────
  registerIconRules(rules: IconRule[]): void
  registerIconPack(pack: Partial<Record<IconToken, string>>): void

  // ── Slots — inject UI into any named extension point ──────────────────────
  registerSlot<S extends SlotId>(
    slot: S,
    component: React.ComponentType<SlotPropsMap[S]>,
    order?: number,
  ): void

  // ── Themes ────────────────────────────────────────────────────────────────
  registerTheme(theme: Omit<ThemeRegistration, 'pluginId'>): void

  // ── Commands ──────────────────────────────────────────────────────────────
  registerCommand(cmd: Omit<CommandRegistration, 'pluginId'>): void

  // ── Editor extensions ─────────────────────────────────────────────────────
  editor: {
    registerToolbarItem(item: Omit<EditorToolbarItem, 'pluginId'>): void
    registerMilkdownPlugin(plugin: unknown): void
  }

  // ── Canvas extensions ─────────────────────────────────────────────────────
  canvas: {
    registerNodeType(type: string, component: React.ComponentType<unknown>): void
  }

  // ── Event bus ─────────────────────────────────────────────────────────────
  on(event: AppEvent, handler: (payload: unknown) => void): void
  off(event: AppEvent, handler: (payload: unknown) => void): void
  emit(event: AppEvent, payload?: unknown): void

  // ── Data APIs ─────────────────────────────────────────────────────────────
  notes: {
    list(): NoteListItem[]
    get(id: string): NoteView | null
    create(data: { title: string; content?: string }): Promise<string>
    update(id: string, patch: NoteWriteData): Promise<void>
    delete(id: string): Promise<void>
  }

  kanban: {
    getBoards(): BoardSummary[]
    createTask(boardId: string, columnId: string, title: string): string
    updateTask(boardId: string, taskId: string, updates: TaskWriteData): void
  }

  // ── Plugin file storage ───────────────────────────────────────────────────
  readPluginData(filename: string): Promise<string | null>
  writePluginData(filename: string, content: string): Promise<void>

  // ── Shared UI + React ─────────────────────────────────────────────────────
  components: typeof import('./sharedComponents')
  React: typeof import('react')
}

export type PluginSetupFn = (api: KairosPluginAPI) => void | Promise<void>

export interface PluginModule {
  default: PluginSetupFn
}

// ─── Install records ──────────────────────────────────────────────────────────
export interface InstalledPlugin {
  id: string
  manifest: PluginManifest
  enabled: boolean
  installedAt: string
  source?: string
}

export interface PluginInstallRequest {
  id: string
  manifestUrl: string
  bundleUrl: string
}
