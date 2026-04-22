import { NavLink, useNavigate } from 'react-router-dom'
import { BookOpen, Menu, Network, Settings2, Share2 } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { SyncControls } from '../Sync/SyncControls'
import { Button } from '../ui/Button'
import { ThemeSelect } from '../ui/ThemeSelect'
import type { ThemeMode } from '../../types'

interface HeaderProps {
  theme: ThemeMode
  setTheme: (t: ThemeMode) => void
}

export function Header({ theme, setTheme }: HeaderProps) {
  const navigate = useNavigate()
  const mobileSidebarOpen = useAppStore((s) => s.mobileSidebarOpen)
  const setMobileSidebarOpen = useAppStore((s) => s.setMobileSidebarOpen)

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        {/* Mobile/tablet sidebar toggle — only visible below lg breakpoint */}
        <button
          className="flex h-8 w-8 items-center justify-center rounded-md text-text2 transition hover:bg-surface2 hover:text-text xl:hidden"
          aria-label={mobileSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        >
          <Menu size={18} />
        </button>

        <button onClick={() => navigate('/')} className="text-left">
          <h1 className="text-lg font-black tracking-tight">MindVault</h1>
          <p className="hidden text-xs text-text2 sm:block">Private-by-default notes and graph</p>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <NavLink to="/notes">
          {({ isActive }) => (
            <Button variant="ghost" size="xs" className={`inline-flex items-center gap-1 ${isActive ? 'text-accent' : ''}`}>
              <BookOpen size={13} />Notes
            </Button>
          )}
        </NavLink>
        <NavLink to="/graph">
          {({ isActive }) => (
            <Button variant="ghost" size="xs" className={`inline-flex items-center gap-1 ${isActive ? 'text-accent' : ''}`}>
              <Network size={13} />Graph
            </Button>
          )}
        </NavLink>
        <NavLink to="/settings">
          {({ isActive }) => (
            <Button variant="ghost" size="xs" className={`inline-flex items-center gap-1 ${isActive ? 'text-accent' : ''}`}>
              <Settings2 size={13} />Settings
            </Button>
          )}
        </NavLink>
        <div className="ml-2"><SyncControls /></div>
        <ThemeSelect value={theme} onChange={setTheme} />
        <Button
          variant="ghost"
          size="xs"
          className="hidden items-center gap-1 sm:inline-flex"
          onClick={() => navigator.clipboard.writeText(window.location.href)}
        >
          <Share2 size={13} />Share
        </Button>
      </div>
    </header>
  )
}
