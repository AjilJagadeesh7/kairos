import React from 'react'
import { useAppStore } from '../store/useAppStore'
import { useKanbanStore } from '../store/useKanbanStore'
import { usePluginStore } from './usePluginStore'
import * as sharedComponents from './sharedComponents'
import type {
  PluginManifest,
  PluginRegistry,
  PluginPageRegistration,
  PluginSettingsRegistration,
  MindVaultPluginAPI,
  AppEvent,
  PluginModule,
} from './types'

// ─── Module-level registry ────────────────────────────────────────────────────
// Not in Zustand — plugin setup() runs outside React's render cycle and mutating
// Zustand during async startup causes tearing. Subscribers are notified after
// each mutation so React can re-render via PluginProvider.

let _registry: PluginRegistry = { pages: [], settings: [] }
let _subs: Array<() => void> = []

export function getRegistry(): PluginRegistry {
  return _registry
}

export function subscribeRegistry(fn: () => void): () => void {
  _subs.push(fn)
  return () => { _subs = _subs.filter(s => s !== fn) }
}

function notifyRegistry() {
  _subs.forEach(fn => { try { fn() } catch { /* ignore */ } })
}

// ─── Event bus ────────────────────────────────────────────────────────────────
type HandlerSet = Set<(payload: unknown) => void>
const _eventMap = new Map<AppEvent, HandlerSet>()

function busOn(event: AppEvent, handler: (payload: unknown) => void) {
  if (!_eventMap.has(event)) _eventMap.set(event, new Set())
  _eventMap.get(event)!.add(handler)
}

function busOff(event: AppEvent, handler: (payload: unknown) => void) {
  _eventMap.get(event)?.delete(handler)
}

export function emitEvent(event: AppEvent, payload?: unknown) {
  _eventMap.get(event)?.forEach(fn => {
    try { fn(payload) } catch (e) { console.warn(`[plugins] handler error in "${event}":`, e) }
  })
}

// ─── API factory ──────────────────────────────────────────────────────────────
function buildPluginAPI(manifest: PluginManifest): MindVaultPluginAPI {
  return {
    pluginId: manifest.id,
    manifest,

    registerPage(reg: Omit<PluginPageRegistration, 'pluginId'>) {
      _registry = { ..._registry, pages: [..._registry.pages, { ...reg, pluginId: manifest.id }] }
      notifyRegistry()
    },

    registerSettingsSection(reg: Omit<PluginSettingsRegistration, 'pluginId'>) {
      _registry = { ..._registry, settings: [..._registry.settings, { ...reg, pluginId: manifest.id }] }
      notifyRegistry()
    },

    on: busOn,
    off: busOff,
    emit: emitEvent,

    getAppStore: () => useAppStore,
    getKanbanStore: () => useKanbanStore,

    async readPluginData(filename: string) {
      const { readPluginFile } = await import('../sync/plainFolder')
      return readPluginFile(manifest.id, filename)
    },
    async writePluginData(filename: string, content: string) {
      const { writePluginFile } = await import('../sync/plainFolder')
      return writePluginFile(manifest.id, filename, content)
    },

    components: sharedComponents,
    React,
  }
}

// ─── Single plugin loader ─────────────────────────────────────────────────────
export async function loadSinglePlugin(pluginId: string): Promise<void> {
  const installed = usePluginStore.getState().getPlugin(pluginId)
  if (!installed) throw new Error(`Plugin "${pluginId}" not found in store`)

  const { readPluginFile } = await import('../sync/plainFolder')
  const code = await readPluginFile(pluginId, installed.manifest.entryPoint)
  if (!code) throw new Error(`Bundle not found: ${pluginId}/${installed.manifest.entryPoint}`)

  const blob = new Blob([code], { type: 'text/javascript' })
  const url  = URL.createObjectURL(blob)

  try {
    // @vite-ignore tells Vite not to statically analyze this import at build time
    const mod = await import(/* @vite-ignore */ url) as PluginModule
    if (typeof mod.default !== 'function') {
      throw new Error(`Plugin "${pluginId}" must export a default setup function`)
    }
    await mod.default(buildPluginAPI(installed.manifest))
    console.info(`[plugins] loaded: ${pluginId} v${installed.manifest.version}`)
  } finally {
    URL.revokeObjectURL(url)
  }
}

// ─── Load all enabled plugins ─────────────────────────────────────────────────
export async function loadAllPlugins(): Promise<void> {
  const { plugins } = usePluginStore.getState()
  const enabled = plugins.filter(p => p.enabled)

  if (enabled.length === 0) {
    emitEvent('app:ready')
    return
  }

  // allSettled — one broken plugin must never block others or the host app
  const results = await Promise.allSettled(
    enabled.map(p => loadSinglePlugin(p.id))
  )

  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.warn(`[plugins] failed to load "${enabled[i].id}":`, r.reason)
    }
  })

  emitEvent('app:ready')
}
