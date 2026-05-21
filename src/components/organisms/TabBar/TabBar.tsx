import { useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  BookOpen, CalendarDays, SquareKanban, Network, Settings2,
  Home, Plus, X,
} from 'lucide-react'
import { useTabStore, pathToType, type Tab } from '../../../store/useTabStore'
import { useAppStore } from '../../../store/useAppStore'

function tabIcon(type: Tab['type'], size = 13) {
  switch (type) {
    case 'notes':    return <BookOpen    size={size} />
    case 'journal':  return <CalendarDays size={size} />
    case 'kanban':   return <SquareKanban size={size} />
    case 'graph':    return <Network      size={size} />
    case 'settings': return <Settings2    size={size} />
    default:         return <Home         size={size} />
  }
}

function deriveTitle(path: string, notes: { id: string; title: string }[]): string {
  if (path === '/' || path === '') return 'Home'
  if (path.startsWith('/notes/')) {
    const id = path.slice('/notes/'.length)
    const note = notes.find(n => n.id === id)
    return note?.title || 'Note'
  }
  if (path === '/notes')    return 'Notes'
  if (path.startsWith('/journal/')) return path.slice('/journal/'.length)
  if (path === '/journal')  return 'Journal'
  if (path.startsWith('/kanban/')) return 'Kanban Board'
  if (path === '/kanban')   return 'Kanban'
  if (path === '/graph')    return 'Graph'
  if (path === '/settings') return 'Settings'
  return 'Page'
}

export function TabBar() {
  const navigate                  = useNavigate()
  const location                  = useLocation()
  const { tabs, activeId, openInNewTab, closeTab, setActiveTab, updateActiveTab } = useTabStore()
  const notes                     = useAppStore(s => s.notes)
  const newTabPage                = useAppStore(s => s.newTabPage)
  const scrollRef                 = useRef<HTMLDivElement>(null)

  // Sync location changes → update active tab's stored path + title
  useEffect(() => {
    const path  = location.pathname
    const title = deriveTitle(path, notes)
    updateActiveTab(path, title)
  }, [location.pathname, notes]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleTabClick(tab: Tab) {
    setActiveTab(tab.id)
    navigate(tab.path)
  }

  function handleClose(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    const wasActive = useTabStore.getState().activeId === id
    closeTab(id)
    if (wasActive) {
      const { activeId: newActiveId, tabs: newTabs } = useTabStore.getState()
      const newTab = newTabs.find(t => t.id === newActiveId)
      if (newTab) navigate(newTab.path)
    }
  }

  function handleNewTab() {
    const path  = newTabPage || '/'
    const title = deriveTitle(path, notes)
    useTabStore.setState(s => {
      const tab = { id: crypto.randomUUID(), path, title, type: pathToType(path) }
      return { tabs: [...s.tabs, tab], activeId: tab.id }
    })
    navigate(path)
  }

  // Ctrl/Cmd+click on nav items fires mv:open-tab events
  useEffect(() => {
    const handler = (e: Event) => {
      const { path, title } = (e as CustomEvent<{ path: string; title: string }>).detail
      openInNewTab(path, title || deriveTitle(path, notes))
      navigate(path)
    }
    window.addEventListener('mv:open-tab', handler)
    return () => window.removeEventListener('mv:open-tab', handler)
  }, [navigate, notes, openInNewTab]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll active tab into view
  useEffect(() => {
    const el = scrollRef.current?.querySelector('[data-active="true"]') as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [activeId])

  return (
    <div className="flex min-h-0 shrink-0 items-stretch border-b border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
      {/* Scrollable tab list + new-tab button right after last tab */}
      <div
        ref={scrollRef}
        className="flex min-w-0 flex-1 items-stretch overflow-x-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        {tabs.map(tab => {
          const isActive = tab.id === activeId
          const title = isActive
            ? deriveTitle(location.pathname, notes)
            : deriveTitle(tab.path, notes)

          return (
            <div
              key={tab.id}
              data-active={isActive}
              className={`group relative flex shrink-0 items-center border-r border-[rgb(var(--border))] text-[12px] transition-colors select-none
                ${isActive
                  ? 'bg-bg text-text'
                  : 'bg-surface text-text3 hover:bg-surface2 hover:text-text2'}`}
              style={{ height: '36px', maxWidth: '200px' }}
            >
              {/* Active indicator bar */}
              {isActive && (
                <span className="pointer-events-none absolute inset-x-0 top-0 h-[2px] rounded-b-full bg-accent" />
              )}

              {/* Main click area */}
              <button
                onClick={() => handleTabClick(tab)}
                className="flex min-w-0 flex-1 items-center gap-1.5 px-3 py-0 h-full"
                style={{ maxWidth: '160px' }}
              >
                <span className={`shrink-0 ${isActive ? 'text-accent' : ''}`}>
                  {tabIcon(pathToType(tab.path))}
                </span>
                <span className="min-w-0 flex-1 truncate text-left">
                  {title}
                </span>
              </button>

              {/* Close button */}
              <button
                aria-label="Close tab"
                onClick={(e) => handleClose(e, tab.id)}
                className="mr-1.5 flex h-4 w-4 shrink-0 items-center justify-center rounded opacity-0 transition-all group-hover:opacity-100 hover:bg-surface3 hover:text-text"
              >
                <X size={10} />
              </button>
            </div>
          )
        })}

        {/* New tab button — sits immediately after the last tab */}
        <button
          onClick={handleNewTab}
          className="flex shrink-0 items-center self-center mx-1 h-6 w-6 justify-center rounded text-text3 transition-colors hover:bg-surface2 hover:text-text2"
          aria-label="New tab"
          title="New tab"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  )
}
