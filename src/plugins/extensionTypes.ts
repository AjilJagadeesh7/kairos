import type React from 'react'
import type { IconToken } from '../icons/tokens'

// ─── Editor toolbar items ─────────────────────────────────────────────────────
// Plugins with 'editor:extend' can register toolbar buttons.
// The host renders them and calls run() with the live ProseMirror EditorView.
// Typed as unknown to avoid coupling the plugin API to Milkdown internals.

export interface EditorToolbarItem {
  pluginId: string
  id: string
  title: string
  iconName?: IconToken
  icon?: React.ComponentType
  order?: number
  run: (view: unknown) => void
  isActive?: (view: unknown) => boolean
}

// ─── Milkdown plugins ─────────────────────────────────────────────────────────
// Plugins with 'editor:extend' can inject raw Milkdown/ProseMirror plugins.
// Typed as unknown so the host bundle is not coupled to @milkdown/* types.

export interface EditorMilkdownPlugin {
  pluginId: string
  plugin: unknown
}

// ─── Themes ───────────────────────────────────────────────────────────────────
// Plugins with 'ui:theme' register CSS variable overrides and/or raw CSS.
// tokens map CSS var names to values: { '--color-accent': '#7c3aed' }
// darkTokens are applied when html[data-theme="dark"].
// rawCSS is injected verbatim — use for @import, animations, component selectors.

export interface ThemeRegistration {
  pluginId: string
  id: string
  name: string
  tokens?: Record<string, string>
  darkTokens?: Record<string, string>
  rawCSS?: string
}

// ─── Canvas node types ────────────────────────────────────────────────────────
// Plugins with 'canvas:extend' register custom ReactFlow node types.
// The type string must be unique across plugins — prefix with plugin id to avoid
// collisions, e.g. 'myplugin:excalidraw'.

export interface CanvasNodeTypeRegistration {
  pluginId: string
  type: string
  component: React.ComponentType<unknown>
}

// ─── Commands ─────────────────────────────────────────────────────────────────
// Plugins with 'ui:commands' add entries to the command palette.

export interface CommandRegistration {
  pluginId: string
  id: string
  label: string
  hint?: string
  iconName?: string
  shortcut?: string
  action: () => void
}
