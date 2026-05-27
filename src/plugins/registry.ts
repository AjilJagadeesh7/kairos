import type { PluginRegistry } from './types'

// ─── Module-level registry ────────────────────────────────────────────────────
// Not in Zustand — plugin setup() runs outside React's render cycle.
// Zustand mutations during async startup cause tearing; plain module state
// with explicit subscriber notifications is safe and predictable.

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

let _registry: PluginRegistry = { ...EMPTY }
let _subs: Array<() => void> = []

export function getRegistry(): PluginRegistry {
  return _registry
}

export function subscribeRegistry(fn: () => void): () => void {
  _subs.push(fn)
  return () => { _subs = _subs.filter(s => s !== fn) }
}

export function updateRegistry(patch: Partial<PluginRegistry>): void {
  _registry = { ..._registry, ...patch }
  _subs.forEach(fn => { try { fn() } catch { /* ignore subscriber errors */ } })
}

export function resetRegistry(): void {
  _registry = { ...EMPTY }
  _subs.forEach(fn => { try { fn() } catch { /* ignore */ } })
}
