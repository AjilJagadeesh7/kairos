import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { getRegistry, subscribeRegistry } from './pluginManager'
import type { IconRule, PluginRegistry } from './types'

const EMPTY: PluginRegistry = { pages: [], settings: [], iconRules: [] }

const PluginRegistryContext = createContext<PluginRegistry>(EMPTY)

export function PluginProvider({ children }: { children: ReactNode }) {
  const [registry, setRegistry] = useState<PluginRegistry>(getRegistry)

  useEffect(() => {
    return subscribeRegistry(() => setRegistry(getRegistry()))
  }, [])

  return (
    <PluginRegistryContext.Provider value={registry}>
      {children}
    </PluginRegistryContext.Provider>
  )
}

export function usePluginRegistry(): PluginRegistry {
  return useContext(PluginRegistryContext)
}

export function useIconRules(): IconRule[] {
  return useContext(PluginRegistryContext).iconRules
}

// Resolve the best matching icon rule for a note
export function resolveNoteIcon(title: string, tags: string[], rules: IconRule[]): IconRule | null {
  for (const rule of rules) {
    if (rule.titleMatch) {
      try { if (new RegExp(rule.titleMatch, 'i').test(title)) return rule } catch { /* skip bad regex */ }
    }
    if (rule.tag && tags.includes(rule.tag)) return rule
  }
  return null
}

// Resolve the best matching icon rule for a folder
export function resolveFolderIcon(name: string, rules: IconRule[]): IconRule | null {
  for (const rule of rules) {
    if (rule.folder) {
      try { if (new RegExp(rule.folder, 'i').test(name)) return rule } catch { /* skip */ }
    }
  }
  return null
}
