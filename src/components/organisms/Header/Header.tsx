import { useAppStore } from '../../../store/useAppStore'
import { usePaneStore } from '../../../store/usePaneStore'
import { usePluginRegistry } from '../../../plugins/pluginContext'
import { Button } from '../../atoms/Button'
import { ThemeSelect } from '../../molecules/ThemeSelect'
import { SyncStatusBadge } from '../../molecules/SyncStatusBadge'
import { Icon } from '../../../icons/Icon'
import type { IconToken } from '../../../icons/tokens'

const NAV_ITEMS: Array<{ to: string; iconName: IconToken; label: string }> = [
  { to: '/journal',  iconName: 'calendar-days', label: 'Journal' },
  { to: '/notes',    iconName: 'book-open',     label: 'Notes' },
  { to: '/kanban',   iconName: 'square-kanban', label: 'Kanban' },
  { to: '/graph',    iconName: 'network',       label: 'Graph' },
  { to: '/settings', iconName: 'settings-2',   label: 'Settings' },
]

export function Header() {
  const theme                = useAppStore((s) => s.theme)
  const setTheme             = useAppStore((s) => s.setTheme)
  const mobileSidebarOpen    = useAppStore((s) => s.mobileSidebarOpen)
  const setMobileSidebarOpen = useAppStore((s) => s.setMobileSidebarOpen)
  const { pages: pluginPages } = usePluginRegistry()

  const activePath = usePaneStore(s => {
    const pane = s.panes.find(p => p.id === s.focusedPaneId)
    return pane?.tabs.find(t => t.id === pane.activeTabId)?.path ?? '/'
  })

  const hasSidebar = activePath.startsWith('/notes')
    || activePath.startsWith('/journal')
    || activePath.startsWith('/settings')
    || activePath.startsWith('/graph')

  function navigate(to: string) {
    const { focusedPaneId, navigatePane } = usePaneStore.getState()
    navigatePane(focusedPaneId, to)
  }

  function handleNavClick(e: React.MouseEvent, to: string, label: string) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const { focusedPaneId, openInNewTab } = usePaneStore.getState()
      openInNewTab(focusedPaneId, to, label)
    }
  }

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2.5 backdrop-blur sm:px-4 sm:py-3">
      <div className="flex items-center gap-2 sm:gap-3">
        {hasSidebar && (
          <button
            className="flex h-8 w-8 items-center justify-center rounded-md text-[rgb(var(--text-2))] transition hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))] xl:hidden"
            aria-label={mobileSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="2" y1="5" x2="16" y2="5" />
              <line x1="2" y1="9" x2="16" y2="9" />
              <line x1="2" y1="13" x2="16" y2="13" />
            </svg>
          </button>
        )}

        <button onClick={() => navigate('/')} className="text-left">
          <h1 className="text-base font-black tracking-tight sm:text-lg">MindVault</h1>
          <p className="hidden text-[10px] text-[rgb(var(--text-2))] sm:block sm:text-xs">
            Private-by-default notes
          </p>
        </button>
      </div>

      <nav aria-label="Main navigation" className="flex items-center gap-0.5 sm:gap-1">
        {NAV_ITEMS.map(({ to, iconName, label }) => {
          const isActive = activePath === to || activePath.startsWith(to + '/')
          return (
            <Button
              key={to}
              variant="ghost"
              size="xs"
              title={`${label} (Ctrl+click to open in new tab)`}
              className={`inline-flex items-center gap-1 px-2 sm:px-2.5 ${isActive ? 'text-[rgb(var(--accent))]' : ''}`}
              onClick={(e) => {
                handleNavClick(e, to, label)
                if (!e.ctrlKey && !e.metaKey) navigate(to)
              }}
            >
              <Icon name={iconName} size={14} />
              <span className="hidden sm:inline">{label}</span>
            </Button>
          )
        })}

        {pluginPages.map(({ path, navLabel, navIcon: NavIcon }) => {
          const isActive = activePath === path || activePath.startsWith(path + '/')
          return (
            <Button
              key={path}
              variant="ghost"
              size="xs"
              title={navLabel}
              className={`inline-flex items-center gap-1 px-2 sm:px-2.5 ${isActive ? 'text-[rgb(var(--accent))]' : ''}`}
              onClick={(e) => {
                handleNavClick(e, path, navLabel)
                if (!e.ctrlKey && !e.metaKey) navigate(path)
              }}
            >
              {NavIcon && <NavIcon size={14} />}
              <span className="hidden sm:inline">{navLabel}</span>
            </Button>
          )
        })}

        <div className="mx-0.5 h-4 w-px bg-[rgb(var(--border))] sm:mx-1" />

        <SyncStatusBadge />
        <ThemeSelect value={theme} onChange={setTheme} />
      </nav>
    </header>
  )
}
