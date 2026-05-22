import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { builtinPack } from './builtinPack'
import { getIconPack, subscribeIconPack } from './iconRegistry'
import type { IconPack, IconToken, IconSource } from './tokens'

const IconPackContext = createContext<IconPack>(builtinPack)

export function IconProvider({ children }: { children: ReactNode }) {
  const [pack, setPack] = useState<IconPack>(getIconPack)

  useEffect(() => subscribeIconPack(() => setPack(getIconPack())), [])

  return (
    <IconPackContext.Provider value={pack}>
      {children}
    </IconPackContext.Provider>
  )
}

export function useIconPack(): IconPack {
  return useContext(IconPackContext)
}

export function useIcon(name: IconToken): IconSource {
  return useContext(IconPackContext)[name]
}
