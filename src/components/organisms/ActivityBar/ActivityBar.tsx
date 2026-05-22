import { useEffect, useRef, useState } from 'react'
import { usePaneStore } from '../../../store/usePaneStore'
import { useAppStore } from '../../../store/useAppStore'
import { usePluginRegistry } from '../../../plugins/pluginContext'
import { SyncStatusBadge } from '../../molecules/SyncStatusBadge'
import { THEME_REGISTRY } from '../../../themes/registry'
import { todayDate } from '../../../store/useJournalStore'
import { Icon } from '../../../icons/Icon'
import type { IconToken } from '../../../icons/tokens'
import type { ThemeMode } from '../../../types'

// ─── Nav items ────────────────────────────────────────────────────────────────

const TOP_NAV: Array<{ to: string; iconName: IconToken; label: string }> = [
  { to: '/notes',   iconName: 'book-open',     label: 'Notes'   },
  { to: '/journal', iconName: 'calendar-days', label: 'Journal' },
  { to: '/kanban',  iconName: 'square-kanban', label: 'Kanban'  },
  { to: '/graph',   iconName: 'network',       label: 'Graph'   },
]

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function show() {
    timer.current = setTimeout(() => setVisible(true), 400)
  }
  function hide() {
    if (timer.current) clearTimeout(timer.current)
    setVisible(false)
  }

  return (
    <div className="relative" onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {visible && (
        <div
          role="tooltip"
          className="pointer-events-none absolute left-full top-1/2 z-[9999] ml-3 -translate-y-1/2 whitespace-nowrap rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text shadow-lg"
        >
          {label}
          {/* Arrow */}
          <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-border" />
          <span className="absolute right-full top-1/2 -translate-y-1/2 ml-px border-4 border-transparent border-r-surface" style={{ marginRight: '-1px' }} />
        </div>
      )}
    </div>
  )
}

// ─── Theme swatch dot ─────────────────────────────────────────────────────────

function ThemeSwatchDot({ bg, accent }: { bg: string; accent: string }) {
  return (
    <span
      className="absolute bottom-2 right-2 h-2 w-2 rounded-full border border-border/60 shadow-sm"
      style={{ background: accent || bg }}
    />
  )
}

// ─── Compact theme picker ────────────────────────────────────────────────────

function CompactThemePicker({ value, onChange }: { value: ThemeMode; onChange: (t: ThemeMode) => void }) {
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
    <Tooltip label={`Theme: ${current.label}`}>
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className={`relative flex h-11 w-12 items-center justify-center transition-colors ${
            open ? 'text-text' : 'text-text3 hover:text-text'
          }`}
        >
          <Icon name="palette" size={20} strokeWidth={1.75} />
          {/* Current theme color indicator dot */}
          <ThemeSwatchDot bg={current.swatchBg} accent={current.swatchAccent} />
        </button>

        {open && (
          <div className="absolute bottom-0 left-full z-50 ml-2 w-48 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-xl">
            <p className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-widest text-text3">Theme</p>
            {THEME_REGISTRY.map(theme => (
              <button
                key={theme.id}
                type="button"
                onClick={() => { onChange(theme.id); setOpen(false) }}
                className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-xs transition ${
                  theme.id === value ? 'bg-accent/10 text-accent font-semibold' : 'text-text hover:bg-surface3'
                }`}
              >
                <span
                  className="relative inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-white/20"
                  style={{ background: theme.swatchBg }}
                >
                  <span
                    className="absolute bottom-0 right-0 h-2 w-2 rounded-full border border-white/20"
                    style={{ background: theme.swatchAccent }}
                  />
                </span>
                {theme.label}
                {theme.id === value && (
                  <span className="ml-auto text-[10px] text-accent">✓</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </Tooltip>
  )
}

// ─── Activity bar ─────────────────────────────────────────────────────────────

export function ActivityBar() {
  const theme    = useAppStore(s => s.theme)
  const setTheme = useAppStore(s => s.setTheme)
  const { pages: pluginPages } = usePluginRegistry()

  const activePath = usePaneStore(s => {
    const pane = s.panes.find(p => p.id === s.focusedPaneId)
    return pane?.tabs.find(t => t.id === pane.activeTabId)?.path ?? '/'
  })

  function go(to: string, label: string, e: React.MouseEvent) {
    if (e.ctrlKey || e.metaKey) {
      const { focusedPaneId, openInNewTab } = usePaneStore.getState()
      openInNewTab(focusedPaneId, to, label)
    } else {
      const { focusedPaneId, navigatePane } = usePaneStore.getState()
      navigatePane(focusedPaneId, to)
    }
  }

  function NavBtn({ to, iconName, label, NavIconComponent }: {
    to: string
    label: string
    iconName?: IconToken
    NavIconComponent?: React.ElementType
  }) {
    const dest = to === '/journal' ? `/journal/${todayDate()}` : to
    const isActive = activePath === to || activePath.startsWith(to + '/')
    return (
      <Tooltip label={label}>
        <button
          type="button"
          onClick={(e) => go(dest, label, e)}
          className={`relative flex h-11 w-12 items-center justify-center transition-colors ${
            isActive ? 'text-accent' : 'text-text3 hover:text-text'
          }`}
        >
          {isActive && (
            <span className="absolute inset-y-1 left-0 w-0.5 rounded-r-full bg-accent" />
          )}
          {iconName
            ? <Icon name={iconName} size={20} strokeWidth={isActive ? 2 : 1.75} />
            : NavIconComponent
              ? <NavIconComponent size={20} strokeWidth={isActive ? 2 : 1.75} />
              : null
          }
        </button>
      </Tooltip>
    )
  }

  return (
    <aside
      aria-label="Activity bar"
      className="flex w-12 shrink-0 flex-col items-center border-r border-border bg-surface2"
    >
      {/* Logo */}
      <Tooltip label="MindVault — Home">
        <button
          type="button"
          onClick={() => {
            const { focusedPaneId, navigatePane } = usePaneStore.getState()
            navigatePane(focusedPaneId, '/')
          }}
          className="flex h-12 w-12 items-center justify-center text-text2 transition hover:text-text"
        >
          <span className="select-none text-[18px] font-black leading-none tracking-tighter">M</span>
        </button>
      </Tooltip>

      <div className="h-px w-6 shrink-0 bg-border/60" />

      {/* Primary nav */}
      <nav className="flex flex-1 flex-col items-center py-1">
        {TOP_NAV.map(item => <NavBtn key={item.to} {...item} />)}

        {pluginPages.map(({ path, navLabel, navIcon: NavIconComponent }) =>
          NavIconComponent
            ? <NavBtn key={path} to={path} label={navLabel} NavIconComponent={NavIconComponent} />
            : null
        )}
      </nav>

      {/* Bottom: sync + theme + settings */}
      <div className="flex flex-col items-center pb-1">
        <div className="mb-1">
          <SyncStatusBadge />
        </div>
        <CompactThemePicker value={theme} onChange={setTheme} />
        <NavBtn to="/settings" iconName="settings-2" label="Settings" />
      </div>
    </aside>
  )
}
