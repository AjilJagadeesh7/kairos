import { useRef, useState, useEffect } from 'react'
import { useAppStore } from '../../../store/useAppStore'
import { usePaneStore, pathToType } from '../../../store/usePaneStore'
import { SyncStatusBadge } from '../../molecules/SyncStatusBadge'
import { THEME_REGISTRY } from '../../../themes/registry'
import { Icon } from '../../../icons/Icon'
import { SectionLabel } from '../../atoms/SectionLabel'
import type { ThemeMode } from '../../../types'

const PAGE_LABELS: Record<string, string> = {
  notes:    'Notes',
  journal:  'Journal',
  kanban:   'Kanban',
  canvas:   'Canvas',
  graph:    'Graph',
  settings: 'Settings',
  home:     'Kairos',
}

const SIDEBAR_PAGES = new Set(['notes', 'journal', 'canvas', 'graph', 'settings'])

function ThemeButton({ value, onChange }: { value: ThemeMode; onChange: (t: ThemeMode) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = THEME_REGISTRY.find(t => t.id === value) ?? THEME_REGISTRY[0]

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Change theme"
        onClick={() => setOpen(v => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-text3 transition hover:bg-surface3 hover:text-text"
      >
        <Icon name="palette" size={19} strokeWidth={1.75} />
        {/* Current theme color dot */}
        <span
          className="absolute bottom-1.5 right-1.5 h-1.5 w-1.5 rounded-full border border-border/60"
          style={{ background: current.swatchAccent || current.swatchBg }}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-xl">
          <SectionLabel className="px-3 pb-1 pt-1.5">Theme</SectionLabel>
          {THEME_REGISTRY.map(theme => (
            <button
              key={theme.id}
              type="button"
              onClick={() => { onChange(theme.id); setOpen(false) }}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-xs transition ${
                theme.id === value ? 'bg-accent/10 text-accent font-semibold' : 'text-text hover:bg-surface3'
              }`}
            >
              <span className="relative inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-white/20"
                style={{ background: theme.swatchBg }}>
                <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full border border-white/20"
                  style={{ background: theme.swatchAccent }} />
              </span>
              {theme.label}
              {theme.id === value && <span className="ml-auto text-[10px]">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function MobileHeader() {
  const sidebarOpen    = useAppStore(s => s.sidebarOpen)
  const setSidebarOpen = useAppStore(s => s.setSidebarOpen)
  const theme          = useAppStore(s => s.theme)
  const setTheme       = useAppStore(s => s.setTheme)

  const activePath = usePaneStore(s => {
    const pane = s.panes.find(p => p.id === s.focusedPaneId)
    return pane?.tabs.find(t => t.id === pane.activeTabId)?.path ?? '/'
  })

  const pageType   = pathToType(activePath)
  const label      = PAGE_LABELS[pageType] ?? 'Kairos'
  const hasSidebar = SIDEBAR_PAGES.has(pageType)
  const isDeepPage = pageType === 'notes' && activePath !== '/notes'

  function goBack() {
    const { focusedPaneId, navigatePane } = usePaneStore.getState()
    // Navigate to the section root (e.g. /notes)
    const root = '/' + pageType
    navigatePane(focusedPaneId, root)
  }

  function goSettings() {
    const { focusedPaneId, navigatePane } = usePaneStore.getState()
    navigatePane(focusedPaneId, '/settings')
  }

  function goHome() {
    const { focusedPaneId, navigatePane } = usePaneStore.getState()
    navigatePane(focusedPaneId, '/')
  }

  return (
    <header
      className="md:hidden flex shrink-0 items-center border-b border-border bg-surface2 px-1"
      style={{ height: 'calc(48px + env(safe-area-inset-top))', paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* Left: back or hamburger */}
      {isDeepPage ? (
        <button
          type="button"
          aria-label="Back"
          onClick={goBack}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-text3 transition hover:bg-surface3 hover:text-text"
        >
          <Icon name="arrow-left" size={20} strokeWidth={1.75} />
        </button>
      ) : hasSidebar ? (
        <button
          type="button"
          aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-text3 transition hover:bg-surface3 hover:text-text"
        >
          <Icon name="menu" size={20} strokeWidth={1.75} />
        </button>
      ) : (
        <span className="w-9" />
      )}

      {/* Center: page title — tap to go to the home dashboard */}
      <button
        type="button"
        onClick={goHome}
        aria-label="Home"
        className="flex-1 truncate px-2 text-center text-sm font-semibold text-text"
      >
        {label}
      </button>

      {/* Right: sync + theme + settings */}
      <div className="flex shrink-0 items-center">
        <SyncStatusBadge />
        <ThemeButton value={theme} onChange={setTheme} />
        {pageType !== 'settings' && (
          <button
            type="button"
            aria-label="Settings"
            onClick={goSettings}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-text3 transition hover:bg-surface3 hover:text-text"
          >
            <Icon name="settings-2" size={19} strokeWidth={1.75} />
          </button>
        )}
      </div>
    </header>
  )
}
