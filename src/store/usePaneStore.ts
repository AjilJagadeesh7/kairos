import { create } from 'zustand'
import { v4 as uuid } from 'uuid'

export type TabType = 'notes' | 'pennote' | 'journal' | 'kanban' | 'canvas' | 'graph' | 'settings' | 'attachment' | 'home'

export function pathToType(path: string): TabType {
  if (path.startsWith('/pennote'))    return 'pennote'
  if (path.startsWith('/notes'))      return 'notes'
  if (path.startsWith('/journal'))    return 'journal'
  if (path.startsWith('/kanban'))     return 'kanban'
  if (path.startsWith('/canvas'))     return 'canvas'
  if (path.startsWith('/graph'))      return 'graph'
  if (path.startsWith('/settings'))   return 'settings'
  if (path.startsWith('/attachment')) return 'attachment'
  return 'home'
}

export type PaneTab = { id: string; path: string; title: string; type: TabType }
export type Pane    = { id: string; tabs: PaneTab[]; activeTabId: string }

type PaneStore = {
  panes: Pane[]
  focusedPaneId: string

  addPane: (afterPaneId: string, initialPath?: string, initialTitle?: string) => void
  removePane: (paneId: string) => void
  setFocusedPane: (paneId: string) => void

  openTab: (paneId: string, path: string, title: string) => void
  openInNewTab: (paneId: string, path: string, title: string) => void
  closeTab: (paneId: string, tabId: string) => void
  setActiveTab: (paneId: string, tabId: string) => void
  updateActiveTab: (paneId: string, path: string, title: string) => void
  reorderTabs: (paneId: string, orderedIds: string[]) => void
  moveTabToPane: (fromPaneId: string, tabId: string, toPaneId: string) => void
  navigatePane: (paneId: string, path: string) => void
}

function makeTab(path: string, title: string): PaneTab {
  return { id: uuid(), path, title, type: pathToType(path) }
}

// Both desktop and mobile launch to the Home dashboard.
const initialTab  = makeTab('/', 'Home')
const initialPane: Pane = { id: uuid(), tabs: [initialTab], activeTabId: initialTab.id }

export const usePaneStore = create<PaneStore>((set, get) => ({
  panes: [initialPane],
  focusedPaneId: initialPane.id,

  addPane(afterPaneId, initialPath = '/notes', initialTitle = 'Notes') {
    const tab  = makeTab(initialPath, initialTitle)
    const pane: Pane = { id: uuid(), tabs: [tab], activeTabId: tab.id }
    set(s => {
      const idx = s.panes.findIndex(p => p.id === afterPaneId)
      const next = [...s.panes]
      next.splice(Math.max(0, idx + 1), 0, pane)
      return { panes: next, focusedPaneId: pane.id }
    })
  },

  removePane(paneId) {
    set(s => {
      if (s.panes.length <= 1) return s
      const newPanes = s.panes.filter(p => p.id !== paneId)
      const removedIdx = s.panes.findIndex(p => p.id === paneId)
      const focusedPaneId = s.focusedPaneId === paneId
        ? (newPanes[Math.max(0, removedIdx - 1)]?.id ?? newPanes[0]?.id ?? '')
        : s.focusedPaneId
      return { panes: newPanes, focusedPaneId }
    })
  },

  setFocusedPane(paneId) { set({ focusedPaneId: paneId }) },

  openTab(paneId, path, title) {
    set(s => ({
      panes: s.panes.map(p => {
        if (p.id !== paneId) return p
        const existing = p.tabs.find(t => t.path === path)
        if (existing) return { ...p, activeTabId: existing.id }
        const tab = makeTab(path, title)
        return { ...p, tabs: [...p.tabs, tab], activeTabId: tab.id }
      }),
      focusedPaneId: paneId,
    }))
  },

  openInNewTab(paneId, path, title) {
    const tab = makeTab(path, title)
    set(s => ({
      panes: s.panes.map(p =>
        p.id !== paneId ? p : { ...p, tabs: [...p.tabs, tab], activeTabId: tab.id }
      ),
      focusedPaneId: paneId,
    }))
  },

  closeTab(paneId, tabId) {
    const { panes } = get()
    const pane = panes.find(p => p.id === paneId)
    if (!pane) return
    if (pane.tabs.length === 1) {
      if (panes.length > 1) get().removePane(paneId)
      return
    }
    const idx       = pane.tabs.findIndex(t => t.id === tabId)
    const newTabs   = pane.tabs.filter(t => t.id !== tabId)
    const newActive = pane.activeTabId === tabId
      ? newTabs[Math.max(0, idx - 1)].id
      : pane.activeTabId
    set(s => ({
      panes: s.panes.map(p =>
        p.id !== paneId ? p : { ...p, tabs: newTabs, activeTabId: newActive }
      ),
    }))
  },

  setActiveTab(paneId, tabId) {
    set(s => ({
      panes: s.panes.map(p => p.id !== paneId ? p : { ...p, activeTabId: tabId }),
      focusedPaneId: paneId,
    }))
  },

  updateActiveTab(paneId, path, title) {
    set(s => ({
      panes: s.panes.map(p => {
        if (p.id !== paneId) return p
        return {
          ...p,
          tabs: p.tabs.map(t =>
            t.id === p.activeTabId ? { ...t, path, title, type: pathToType(path) } : t
          ),
        }
      }),
    }))
  },

  reorderTabs(paneId, orderedIds) {
    set(s => ({
      panes: s.panes.map(p => {
        if (p.id !== paneId) return p
        const map = new Map(p.tabs.map(t => [t.id, t]))
        return { ...p, tabs: orderedIds.flatMap(id => { const t = map.get(id); return t ? [t] : [] }) }
      }),
    }))
  },

  moveTabToPane(fromPaneId, tabId, toPaneId) {
    set(s => {
      const fromPane = s.panes.find(p => p.id === fromPaneId)
      const tab      = fromPane?.tabs.find(t => t.id === tabId)
      if (!tab) return s

      const newPanes = s.panes.flatMap(p => {
        if (p.id === fromPaneId) {
          const newTabs = p.tabs.filter(t => t.id !== tabId)
          if (newTabs.length === 0) return []
          const idx = p.tabs.findIndex(t => t.id === tabId)
          return [{ ...p, tabs: newTabs, activeTabId: p.activeTabId === tabId ? newTabs[Math.max(0, idx - 1)].id : p.activeTabId }]
        }
        if (p.id === toPaneId) {
          return [{ ...p, tabs: [...p.tabs, tab], activeTabId: tab.id }]
        }
        return [p]
      })

      const focusedPaneId = newPanes.find(p => p.id === s.focusedPaneId)
        ? toPaneId
        : (newPanes[0]?.id ?? '')

      return { panes: newPanes, focusedPaneId }
    })
  },

  navigatePane(paneId, path) {
    set(s => ({
      panes: s.panes.map(p => {
        if (p.id !== paneId) return p
        return {
          ...p,
          tabs: p.tabs.map(t =>
            t.id === p.activeTabId ? { ...t, path, type: pathToType(path) } : t
          ),
        }
      }),
    }))
  },
}))
