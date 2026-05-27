import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { getRegistry, subscribeRegistry } from './registry'
import type { IconRule, PluginRegistry } from './types'
import type { SlotId, SlotPropsMap, SlotRegistration } from './slotTypes'
import type { CommandRegistration, ThemeRegistration, EditorToolbarItem } from './extensionTypes'

const EMPTY: PluginRegistry = {
  pages: [],
  settings: [],
  iconRules: [],
  slots: [],
  themes: [],
  commands: [],
  editorToolbarItems: [],
  editorMilkdownPlugins: [],
  canvasNodeTypes: [],
}

const PluginRegistryContext = createContext<PluginRegistry>(EMPTY)

export function PluginProvider({ children }: { children: ReactNode }) {
  const [registry, setRegistry] = useState<PluginRegistry>(getRegistry)

  useEffect(() => subscribeRegistry(() => setRegistry(getRegistry())), [])

  return (
    <PluginRegistryContext.Provider value={registry}>
      {children}
    </PluginRegistryContext.Provider>
  )
}

// ─── Registry hooks ───────────────────────────────────────────────────────────

export function usePluginRegistry(): PluginRegistry {
  return useContext(PluginRegistryContext)
}

export function useIconRules(): IconRule[] {
  return useContext(PluginRegistryContext).iconRules
}

export function usePluginSlots<S extends SlotId>(slot: S): SlotRegistration<S>[] {
  const slots = useContext(PluginRegistryContext).slots
  return (slots as SlotRegistration<S>[]).filter(s => s.slot === slot)
}

export function usePluginThemes(): ThemeRegistration[] {
  return useContext(PluginRegistryContext).themes
}

export function usePluginCommands(): CommandRegistration[] {
  return useContext(PluginRegistryContext).commands
}

export function useEditorToolbarItems(): EditorToolbarItem[] {
  return useContext(PluginRegistryContext).editorToolbarItems
}

export function useCanvasNodeTypes(): Record<string, React.ComponentType<unknown>> {
  const types = useContext(PluginRegistryContext).canvasNodeTypes
  return Object.fromEntries(types.map(r => [r.type, r.component]))
}

// ─── Icon rule helpers ────────────────────────────────────────────────────────

export function resolveNoteIcon(title: string, tags: string[], rules: IconRule[]) {
  for (const rule of rules) {
    if (rule.titleMatch) {
      try { if (new RegExp(rule.titleMatch, 'i').test(title)) return rule } catch { /* skip bad regex */ }
    }
    if (rule.tag && tags.includes(rule.tag)) return rule
  }
  return null
}

export function resolveFolderIcon(name: string, rules: IconRule[]) {
  for (const rule of rules) {
    if (rule.folder) {
      try { if (new RegExp(rule.folder, 'i').test(name)) return rule } catch { /* skip */ }
    }
  }
  return null
}

// Re-export types consumed by callers of this module
export type { SlotId, SlotPropsMap, SlotRegistration }
export type { CommandRegistration, ThemeRegistration, EditorToolbarItem }
