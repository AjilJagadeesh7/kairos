import React from 'react'
import { useAppStore } from '../store/useAppStore'
import { useKanbanStore } from '../store/useKanbanStore'
import { usePluginStore } from './usePluginStore'
import * as sharedComponents from './sharedComponents'
import { gate, PermissionError } from './permissionGate'
import { indexNote } from '../search/noteIndex'
import { logger } from '../logger/logger'
import type {
  PluginManifest,
  PluginRegistry,
  PluginPageRegistration,
  PluginSettingsRegistration,
  MindVaultPluginAPI,
  AppEvent,
  PluginModule,
  NoteListItem,
  NoteView,
  NoteWriteData,
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
  const id = manifest.id

  return {
    pluginId: id,
    manifest,

    // ── UI registration ────────────────────────────────────────────────────────
    registerPage(reg: Omit<PluginPageRegistration, 'pluginId'>) {
      gate(manifest, 'ui:page', 'registerPage')
      _registry = { ..._registry, pages: [..._registry.pages, { ...reg, pluginId: id }] }
      notifyRegistry()
    },

    registerSettingsSection(reg: Omit<PluginSettingsRegistration, 'pluginId'>) {
      gate(manifest, 'ui:settings', 'registerSettingsSection')
      _registry = { ..._registry, settings: [..._registry.settings, { ...reg, pluginId: id }] }
      notifyRegistry()
    },

    // ── Event bus ──────────────────────────────────────────────────────────────
    on(event: AppEvent, handler: (payload: unknown) => void) {
      gate(manifest, 'events', `subscribe to "${event}"`)
      busOn(event, handler)
    },

    off: busOff,

    emit(event: AppEvent, payload?: unknown) {
      gate(manifest, 'events', `emit "${event}"`)
      emitEvent(event, payload)
    },

    // ── Notes API ──────────────────────────────────────────────────────────────
    notes: {
      list(): NoteListItem[] {
        gate(manifest, 'read:notes', 'notes.list')
        return useAppStore.getState().notes.map(({ id: nid, title, tags, updatedAt, createdAt }) => ({
          id: nid, title, tags, updatedAt, createdAt,
        }))
      },

      get(noteId: string): NoteView | null {
        gate(manifest, 'read:notes', 'notes.get')
        const note = useAppStore.getState().notes.find(n => n.id === noteId) ?? null
        if (!note) return null
        const { id: nid, title, content, tags, updatedAt, createdAt } = note
        return { id: nid, title, content, tags, updatedAt, createdAt }
      },

      async create(data: { title: string; content?: string }): Promise<string> {
        gate(manifest, 'write:notes', 'notes.create')
        return useAppStore.getState().createNote({ title: data.title, content: data.content })
      },

      async update(noteId: string, patch: NoteWriteData): Promise<void> {
        gate(manifest, 'write:notes', 'notes.update')
        const { notes } = useAppStore.getState()
        const note = notes.find(n => n.id === noteId)
        if (!note) throw new Error(`Plugin "${id}": note "${noteId}" not found`)

        const updated = {
          ...note,
          title:     patch.title     ?? note.title,
          content:   patch.content   ?? note.content,
          tags:      patch.tags      ?? note.tags,
          updatedAt: new Date().toISOString(),
        }

        indexNote(updated)
        useAppStore.setState(s => ({ notes: s.notes.map(n => n.id === noteId ? updated : n) }))

        const { writePlainNote, appendNoteVersion, isPlainFolderConnected } = await import('../sync/plainFolder')
        if (isPlainFolderConnected()) {
          await writePlainNote(updated)
          appendNoteVersion(noteId, { savedAt: updated.updatedAt, title: updated.title, content: updated.content })
            .catch(() => { /* best-effort */ })
        }

        // Push to sync providers and queue if offline — same path as the editor
        const { pushNoteToAll, anySyncProviderConnected } = await import('../sync/syncOrchestrator')
        if (anySyncProviderConnected()) {
          useAppStore.getState().setSyncStatus('syncing')
          pushNoteToAll(updated)
            .then(() => useAppStore.getState().setSyncStatus('ok'))
            .catch(() => {
              useAppStore.getState().setSyncStatus('error')
              void import('../sync/offlineQueue').then(({ enqueue }) => enqueue(noteId))
            })
        }
      },

      async delete(noteId: string): Promise<void> {
        gate(manifest, 'write:notes', 'notes.delete')
        await useAppStore.getState().deleteNoteById(noteId)
      },
    },

    // ── Kanban API ─────────────────────────────────────────────────────────────
    kanban: {
      getBoards() {
        gate(manifest, 'read:kanban', 'kanban.getBoards')
        return useKanbanStore.getState().boards.map(({ id: bid, title }) => ({ id: bid, title }))
      },

      createTask(boardId: string, columnId: string, title: string): string {
        gate(manifest, 'write:kanban', 'kanban.createTask')
        return useKanbanStore.getState().createTask(boardId, columnId, title)
      },

      updateTask(boardId: string, taskId: string, updates: Parameters<MindVaultPluginAPI['kanban']['updateTask']>[2]): void {
        gate(manifest, 'write:kanban', 'kanban.updateTask')
        useKanbanStore.getState().updateTask(boardId, taskId, updates)
      },
    },

    // ── Plugin file storage ────────────────────────────────────────────────────
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
    const mod = await import(/* @vite-ignore */ url) as PluginModule
    if (typeof mod.default !== 'function') {
      throw new Error(`Plugin "${pluginId}" must export a default setup function`)
    }
    await mod.default(buildPluginAPI(installed.manifest))
    logger.info(`loaded: ${pluginId} v${installed.manifest.version}`, 'plugins')
  } catch (err) {
    if (err instanceof PermissionError) {
      // Log the violation and re-throw so allSettled marks this plugin as failed
      logger.error(err.message, 'plugins:permission', err)
    }
    throw err
  } finally {
    URL.revokeObjectURL(url)
  }
}

// ─── Scan vault plugins/ folder and auto-register new plugins ────────────────
export async function scanLocalPlugins(): Promise<void> {
  const { listPluginIds, readPluginFile } = await import('../sync/plainFolder')
  const ids = await listPluginIds()

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
      // Folder name is the authoritative id — overrides whatever manifest.id says
      manifest.id = id

      const existing = usePluginStore.getState().getPlugin(id)
      if (existing && existing.manifest.version === manifest.version) continue

      // New plugin or manifest changed — register / update
      usePluginStore.getState().addPlugin({
        id,
        manifest,
        enabled: existing?.enabled ?? true,
        installedAt: existing?.installedAt ?? new Date().toISOString(),
        source: 'local',
      })

      if (existing) {
        logger.info(`updated manifest: ${id} v${manifest.version}`, 'plugins')
      } else {
        logger.info(`discovered local plugin: ${id}`, 'plugins')
      }
    } catch (e) {
      logger.error(`failed to parse manifest in plugins/${id}/`, 'plugins', e)
    }
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
      logger.error(`failed to load "${enabled[i].id}"`, 'plugins', r.reason)
    }
  })

  emitEvent('app:ready')
}
