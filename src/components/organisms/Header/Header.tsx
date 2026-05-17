import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, Kanban, Network, Settings2 } from 'lucide-react'
import { useAppStore } from '../../../store/useAppStore'
import { Button } from '../../atoms/Button'
import { ThemeSelect } from '../../molecules/ThemeSelect'
import { SyncStatusBadge } from '../../molecules/SyncStatusBadge'

export function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const theme                = useAppStore((s) => s.theme)
  const setTheme             = useAppStore((s) => s.setTheme)
  const mobileSidebarOpen    = useAppStore((s) => s.mobileSidebarOpen)
  const setMobileSidebarOpen = useAppStore((s) => s.setMobileSidebarOpen)

  // Hamburger is shown on pages that have a sidebar drawer
  const hasSidebar = location.pathname.startsWith('/notes') || location.pathname.startsWith('/settings') || location.pathname.startsWith('/graph')


  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        {/* Mobile sidebar toggle — only on notes pages */}
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
          <h1 className="text-lg font-black tracking-tight">MindVault</h1>
          <p className="hidden text-xs text-[rgb(var(--text-2))] sm:block">Private-by-default notes</p>
        </button>
      </div>

      <div className="flex items-center gap-1">
        <NavLink to="/notes">
          {({ isActive }) => (
            <Button variant="ghost" size="xs" className={`inline-flex items-center gap-1 ${isActive ? 'text-[rgb(var(--accent))]' : ''}`}>
              <BookOpen size={13} /> Notes
            </Button>
          )}
        </NavLink>
        <NavLink to="/kanban">
          {({ isActive }) => (
            <Button variant="ghost" size="xs" className={`inline-flex items-center gap-1 ${isActive ? 'text-[rgb(var(--accent))]' : ''}`}>
              <Kanban size={13} /> Kanban
            </Button>
          )}
        </NavLink>
        <NavLink to="/graph">
          {({ isActive }) => (
            <Button variant="ghost" size="xs" className={`inline-flex items-center gap-1 ${isActive ? 'text-[rgb(var(--accent))]' : ''}`}>
              <Network size={13} /> Graph
            </Button>
          )}
        </NavLink>
        <NavLink to="/settings">
          {({ isActive }) => (
            <Button variant="ghost" size="xs" className={`inline-flex items-center gap-1 ${isActive ? 'text-[rgb(var(--accent))]' : ''}`}>
              <Settings2 size={13} /> Settings
            </Button>
          )}
        </NavLink>

        <div className="mx-1 h-4 w-px bg-[rgb(var(--border))]" />

        {/* Sync status — clicking goes to Settings › Sync */}
        <SyncStatusBadge />
        <ThemeSelect value={theme} onChange={setTheme} />
      </div>
    </header>
  )
}
