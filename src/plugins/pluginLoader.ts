import { usePluginStore } from './usePluginStore'
import { emitEvent } from './eventBus'
import { resetRegistry } from './registry'
import { buildPluginAPI } from './apiFactory'
import { logger } from '../logger/logger'
import { PermissionError } from './permissionGate'
import type { PluginManifest, PluginModule } from './types'

// ─── Session-level load guard ─────────────────────────────────────────────────
// Prevents duplicate loads from React StrictMode double-invocation, HMR
// remounts, or any other re-entry into the startup sequence.
//
// _loadingPromise: deduplicates concurrent calls — callers join the same run.
// _loaded:         skips subsequent calls once the session has loaded once.
//
// Call resetPluginSession() when the vault is reconnected to a different folder
// so plugins are re-scanned and re-loaded with a clean registry.

let _loadingPromise: Promise<void> | null = null
let _loaded = false

export function resetPluginSession(): void {
  _loadingPromise = null
  _loaded = false
}

export async function loadSinglePlugin(pluginId: string): Promise<void> {
  const installed = usePluginStore.getState().getPlugin(pluginId)
  if (!installed) throw new Error(`Plugin "${pluginId}" not found in store`)

  const { readPluginFile } = await import('../sync/plainFolder')
  const code = await readPluginFile(pluginId, installed.manifest.entryPoint)
  if (!code) throw new Error(`Bundle not found: ${pluginId}/${installed.manifest.entryPoint}`)

  const blob = new Blob([code], { type: 'text/javascript' })
  const url  = URL.createObjectURL(blob)

  try {
    const mod = await import(/* @vite-ignore */ url) as PluginModule
    if (typeof mod.default !== 'function') {
      throw new Error(`Plugin "${pluginId}" must export a default setup function`)
    }
    await mod.default(buildPluginAPI(installed.manifest))
    logger.info(`loaded: ${pluginId} v${installed.manifest.version}`, 'plugins')
  } catch (err) {
    if (err instanceof PermissionError) {
      logger.error(err.message, 'plugins:permission', err)
    }
    throw err
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function scanLocalPlugins(): Promise<void> {
  const { listPluginIds, readPluginFile } = await import('../sync/plainFolder')
  const ids = await listPluginIds()
  const idSet = new Set(ids)

  for (const p of usePluginStore.getState().plugins) {
    if (p.source === 'local' && !idSet.has(p.id)) {
      usePluginStore.getState().removePlugin(p.id)
      logger.info(`removed stale plugin: ${p.id}`, 'plugins')
    }
  }

  for (const id of ids) {
    const raw = await readPluginFile(id, 'manifest.json')
    if (!raw) {
      logger.warn(`no manifest.json found in plugins/${id}/`, 'plugins')
      continue
    }

    try {
      const manifest = JSON.parse(raw) as PluginManifest
      if (!manifest.name || !manifest.version || !manifest.entryPoint) {
        logger.warn(`manifest in plugins/${id}/ is missing required fields`, 'plugins')
        continue
      }
      manifest.id = id

      const existing = usePluginStore.getState().getPlugin(id)
      if (existing && existing.manifest.version === manifest.version) continue

      usePluginStore.getState().addPlugin({
        id, manifest,
        enabled: existing?.enabled ?? true,
        installedAt: existing?.installedAt ?? new Date().toISOString(),
        source: 'local',
      })

      logger.info(
        existing ? `updated manifest: ${id} v${manifest.version}` : `discovered local plugin: ${id}`,
        'plugins',
      )
    } catch (e) {
      logger.error(`failed to parse manifest in plugins/${id}/`, 'plugins', e)
    }
  }
}

async function _doLoadAll(): Promise<void> {
  // Always reset the registry before loading so a re-run starts completely clean.
  resetRegistry()

  const { plugins } = usePluginStore.getState()
  const enabled = plugins.filter(p => p.enabled)

  if (enabled.length === 0) {
    emitEvent('app:ready')
    return
  }

  // allSettled — one broken plugin must never block others or the host app
  const results = await Promise.allSettled(enabled.map(p => loadSinglePlugin(p.id)))
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      logger.error(`failed to load "${enabled[i].id}"`, 'plugins', r.reason)
    }
  })

  emitEvent('app:ready')
}

export async function loadAllPlugins(): Promise<void> {
  // Already loaded this session — skip entirely
  if (_loaded) return

  // Currently loading — join the in-flight promise instead of starting a second run
  if (_loadingPromise) return _loadingPromise

  _loadingPromise = _doLoadAll().finally(() => {
    _loaded = true
    _loadingPromise = null
  })

  return _loadingPromise
}
