import React from 'react'
import * as sharedComponents from './sharedComponents'
import { gate } from './permissionGate'
import { applyIconPackPatch } from '../icons/iconRegistry'
import { getRegistry, updateRegistry } from './registry'
import { busOn, busOff, emitEvent } from './eventBus'
import { buildNotesApi } from './notesApi'
import { buildKanbanApi } from './kanbanApi'
import type {
  PluginManifest,
  KairosPluginAPI,
  AppEvent,
  PluginPageRegistration,
  PluginSettingsRegistration,
  IconRule,
} from './types'
import type { IconToken } from '../icons/tokens'
import type { SlotId, SlotPropsMap, SlotRegistration } from './slotTypes'
import type { ThemeRegistration, CommandRegistration, EditorToolbarItem, CanvasNodeTypeRegistration } from './extensionTypes'

export function buildPluginAPI(manifest: PluginManifest): KairosPluginAPI {
  const id = manifest.id

  return {
    pluginId: id,
    manifest,

    // ── Pages ────────────────────────────────────────────────────────────────
    registerPage(reg: Omit<PluginPageRegistration, 'pluginId'>) {
      gate(manifest, 'ui:page', 'registerPage')
      const entry = { ...reg, pluginId: id }
      const pages = getRegistry().pages
      const existing = pages.findIndex(p => p.path === reg.path)
      updateRegistry({
        pages: existing >= 0 ? pages.map((p, i) => (i === existing ? entry : p)) : [...pages, entry],
      })
    },

    // ── Settings sections ────────────────────────────────────────────────────
    registerSettingsSection(reg: Omit<PluginSettingsRegistration, 'pluginId'>) {
      gate(manifest, 'ui:settings', 'registerSettingsSection')
      updateRegistry({ settings: [...getRegistry().settings, { ...reg, pluginId: id }] })
    },

    // ── Icons ────────────────────────────────────────────────────────────────
    registerIconRules(rules: IconRule[]) {
      gate(manifest, 'ui:icons', 'registerIconRules')
      updateRegistry({ iconRules: [...getRegistry().iconRules, ...rules] })
    },

    registerIconPack(pack: Partial<Record<IconToken, string>>) {
      gate(manifest, 'ui:icons', 'registerIconPack')
      applyIconPackPatch(pack)
    },

    // ── Slots ────────────────────────────────────────────────────────────────
    registerSlot<S extends SlotId>(
      slot: S,
      component: React.ComponentType<SlotPropsMap[S]>,
      order?: number,
    ) {
      gate(manifest, 'ui:slot', 'registerSlot')
      const reg: SlotRegistration<S> = { pluginId: id, slot, component, order }
      updateRegistry({ slots: [...getRegistry().slots, reg as unknown as SlotRegistration] })
    },

    // ── Themes ───────────────────────────────────────────────────────────────
    registerTheme(theme: Omit<ThemeRegistration, 'pluginId'>) {
      gate(manifest, 'ui:theme', 'registerTheme')
      updateRegistry({ themes: [...getRegistry().themes, { ...theme, pluginId: id }] })
    },

    // ── Commands ─────────────────────────────────────────────────────────────
    registerCommand(cmd: Omit<CommandRegistration, 'pluginId'>) {
      gate(manifest, 'ui:commands', 'registerCommand')
      updateRegistry({ commands: [...getRegistry().commands, { ...cmd, pluginId: id }] })
    },

    // ── Editor extensions ─────────────────────────────────────────────────────
    editor: {
      registerToolbarItem(item: Omit<EditorToolbarItem, 'pluginId'>) {
        gate(manifest, 'editor:extend', 'editor.registerToolbarItem')
        updateRegistry({
          editorToolbarItems: [...getRegistry().editorToolbarItems, { ...item, pluginId: id }],
        })
      },

      registerMilkdownPlugin(plugin: unknown) {
        gate(manifest, 'editor:extend', 'editor.registerMilkdownPlugin')
        updateRegistry({
          editorMilkdownPlugins: [...getRegistry().editorMilkdownPlugins, { pluginId: id, plugin }],
        })
      },
    },

    // ── Event bus ────────────────────────────────────────────────────────────
    on(event: AppEvent, handler: (payload: unknown) => void) {
      gate(manifest, 'events', `subscribe to "${event}"`)
      busOn(event, handler)
    },

    off: busOff,

    emit(event: AppEvent, payload?: unknown) {
      gate(manifest, 'events', `emit "${event}"`)
      emitEvent(event, payload)
    },

    // ── Canvas extensions ─────────────────────────────────────────────────────
    canvas: {
      registerNodeType(type: string, component: React.ComponentType<unknown>) {
        gate(manifest, 'canvas:extend', 'canvas.registerNodeType')
        const reg: CanvasNodeTypeRegistration = { pluginId: id, type, component }
        updateRegistry({ canvasNodeTypes: [...getRegistry().canvasNodeTypes, reg] })
      },
    },

    // ── Data APIs ────────────────────────────────────────────────────────────
    notes: buildNotesApi(manifest),
    kanban: buildKanbanApi(manifest),

    // ── Plugin file storage ───────────────────────────────────────────────────
    async readPluginData(filename: string) {
      const { readPluginFile } = await import('../sync/plainFolder')
      return readPluginFile(id, filename)
    },

    async writePluginData(filename: string, content: string) {
      const { writePluginFile } = await import('../sync/plainFolder')
      return writePluginFile(id, filename, content)
    },

    components: sharedComponents,
    React,
  }
}
