import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { getRegistry, subscribeRegistry } from './pluginManager'
import type { PluginRegistry } from './types'

const EMPTY: PluginRegistry = { pages: [], settings: [] }

const PluginRegistryContext = createContext<PluginRegistry>(EMPTY)

export function PluginProvider({ children }: { children: ReactNode }) {
  const [registry, setRegistry] = useState<PluginRegistry>(getRegistry)

  useEffect(() => {
    // Re-render whenever a plugin calls registerPage or registerSettingsSection
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
