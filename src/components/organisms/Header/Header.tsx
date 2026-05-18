import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, CalendarDays, SquareKanban, Network, Settings2 } from 'lucide-react'
import { useAppStore } from '../../../store/useAppStore'
import { usePluginRegistry } from '../../../plugins/pluginContext'
import { Button } from '../../atoms/Button'
import { ThemeSelect } from '../../molecules/ThemeSelect'
import { SyncStatusBadge } from '../../molecules/SyncStatusBadge'

const NAV_ITEMS = [
  { to: '/journal',  Icon: CalendarDays, label: 'Journal' },
  { to: '/notes',    Icon: BookOpen,     label: 'Notes' },
  { to: '/kanban',   Icon: SquareKanban, label: 'Kanban' },
  { to: '/graph',    Icon: Network,      label: 'Graph' },
  { to: '/settings', Icon: Settings2,    label: 'Settings' },
]

export function Header() {
  const navigate             = useNavigate()
  const location             = useLocation()
  const theme                = useAppStore((s) => s.theme)
  const setTheme             = useAppStore((s) => s.setTheme)
  const mobileSidebarOpen    = useAppStore((s) => s.mobileSidebarOpen)
  const setMobileSidebarOpen = useAppStore((s) => s.setMobileSidebarOpen)
  const { pages: pluginPages } = usePluginRegistry()

  const hasSidebar = location.pathname.startsWith('/notes')
    || location.pathname.startsWith('/journal')
    || location.pathname.startsWith('/settings')
    || location.pathname.startsWith('/graph')

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
        {/* Core nav — icons only on xs, icon+label on sm+ */}
        {NAV_ITEMS.map(({ to, Icon, label }) => (
          <NavLink key={to} to={to}>
            {({ isActive }) => (
              <Button
                variant="ghost"
                size="xs"
                title={label}
                className={`inline-flex items-center gap-1 px-2 sm:px-2.5 ${isActive ? 'text-[rgb(var(--accent))]' : ''}`}
              >
                <Icon size={14} />
                <span className="hidden sm:inline">{label}</span>
              </Button>
            )}
          </NavLink>
        ))}

        {/* Plugin-registered nav items */}
        {pluginPages.map(({ path, navLabel, navIcon: NavIcon }) => (
          <NavLink key={path} to={path}>
            {({ isActive }) => (
              <Button
                variant="ghost"
                size="xs"
                title={navLabel}
                className={`inline-flex items-center gap-1 px-2 sm:px-2.5 ${isActive ? 'text-[rgb(var(--accent))]' : ''}`}
              >
                {NavIcon && <NavIcon size={14} />}
                <span className="hidden sm:inline">{navLabel}</span>
              </Button>
            )}
          </NavLink>
        ))}

        <div className="mx-0.5 h-4 w-px bg-[rgb(var(--border))] sm:mx-1" />

        <SyncStatusBadge />
        <ThemeSelect value={theme} onChange={setTheme} />
      </nav>
    </header>
  )
}
