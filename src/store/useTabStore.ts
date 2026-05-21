import { create } from 'zustand'
import { v4 as uuid } from 'uuid'

export type TabType = 'notes' | 'journal' | 'kanban' | 'graph' | 'settings' | 'home'

export type Tab = {
  id: string
  path: string
  title: string
  type: TabType
}

export function pathToType(path: string): TabType {
  if (path.startsWith('/notes'))    return 'notes'
  if (path.startsWith('/journal'))  return 'journal'
  if (path.startsWith('/kanban'))   return 'kanban'
  if (path.startsWith('/graph'))    return 'graph'
  if (path.startsWith('/settings')) return 'settings'
  return 'home'
}

type TabStore = {
  tabs: Tab[]
  activeId: string
  openInNewTab: (path: string, title: string) => void
  closeTab: (id: string) => void
  setActiveTab: (id: string) => void
  updateActiveTab: (path: string, title: string) => void
}

const initialTab: Tab = { id: uuid(), path: '/notes', title: 'Notes', type: 'notes' }

export const useTabStore = create<TabStore>((set, get) => ({
  tabs: [initialTab],
  activeId: initialTab.id,

  openInNewTab(path, title) {
    const existing = get().tabs.find(t => t.path === path)
    if (existing) {
      set({ activeId: existing.id })
      return
    }
    const tab: Tab = { id: uuid(), path, title, type: pathToType(path) }
    set(s => ({ tabs: [...s.tabs, tab], activeId: tab.id }))
  },

  closeTab(id) {
    const { tabs, activeId } = get()
    if (tabs.length === 1) return
    const idx = tabs.findIndex(t => t.id === id)
    const newTabs = tabs.filter(t => t.id !== id)
    const newActiveId = activeId === id ? newTabs[Math.max(0, idx - 1)].id : activeId
    set({ tabs: newTabs, activeId: newActiveId })
  },

  setActiveTab(id) {
    set({ activeId: id })
  },

  updateActiveTab(path, title) {
    set(s => ({
      tabs: s.tabs.map(t =>
        t.id === s.activeId ? { ...t, path, title, type: pathToType(path) } : t,
      ),
    }))
  },
}))
