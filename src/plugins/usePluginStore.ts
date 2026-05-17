import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { InstalledPlugin } from './types'

type PluginStoreState = {
  plugins: InstalledPlugin[]
  addPlugin(plugin: InstalledPlugin): void
  removePlugin(id: string): void
  setEnabled(id: string, enabled: boolean): void
  getPlugin(id: string): InstalledPlugin | undefined
  isInstalled(id: string): boolean
}

export const usePluginStore = create<PluginStoreState>()(
  persist(
    (set, get) => ({
      plugins: [],

      addPlugin: (plugin) =>
        set(s => ({ plugins: [...s.plugins.filter(p => p.id !== plugin.id), plugin] })),

      removePlugin: (id) =>
        set(s => ({ plugins: s.plugins.filter(p => p.id !== id) })),

      setEnabled: (id, enabled) =>
        set(s => ({ plugins: s.plugins.map(p => p.id === id ? { ...p, enabled } : p) })),

      getPlugin: (id) => get().plugins.find(p => p.id === id),
      isInstalled: (id) => get().plugins.some(p => p.id === id),
    }),
    { name: 'mindvault-plugins' },
  ),
)
