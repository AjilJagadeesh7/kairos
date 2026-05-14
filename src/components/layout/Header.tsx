import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, Cloud, CloudOff, Network, Settings2 } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { Button } from '../ui/Button'
import { ThemeSelect } from '../ui/ThemeSelect'
import { anySyncProviderConnected } from '../../sync/syncOrchestrator'

function SyncStatusBadge() {
  const syncStatus = useAppStore((s) => s.syncStatus)
  const connected = anySyncProviderConnected()

  const dotColor =
    syncStatus === 'ok'      ? 'bg-green-500'  :
    syncStatus === 'syncing' ? 'bg-yellow-400 animate-pulse' :
    syncStatus === 'error'   ? 'bg-red-400'    : 'bg-[rgb(var(--surface-3))]'

  return (
    <NavLink to="/settings" title={connected ? `Sync active · ${syncStatus}` : 'Sync disabled — click to configure'}>
      <div className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-[rgb(var(--text-2))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]">
        {connected ? <Cloud size={13} /> : <CloudOff size={13} />}
        <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
      </div>
    </NavLink>
  )
}

export function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const theme                = useAppStore((s) => s.theme)
  const setTheme             = useAppStore((s) => s.setTheme)
  const mobileSidebarOpen    = useAppStore((s) => s.mobileSidebarOpen)
  const setMobileSidebarOpen = useAppStore((s) => s.setMobileSidebarOpen)

  // Hamburger is shown on pages that have a sidebar drawer
  const hasSidebar = location.pathname.startsWith('/notes') || location.pathname.startsWith('/settings')

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
