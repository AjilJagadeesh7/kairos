import { useCallback, useEffect, useRef, useState } from 'react'
import { usePaneStore, pathToType } from '../../../store/usePaneStore'
import { useAppStore } from '../../../store/useAppStore'
import { usePluginRegistry } from '../../../plugins/pluginContext'
import { SyncStatusBadge } from '../../molecules/SyncStatusBadge'
import { SlotRenderer } from '../../molecules/SlotRenderer'
import { THEME_REGISTRY } from '../../../themes/registry'
import { ThemeOptionList } from '../../molecules/ThemeOptionList'
import { todayDate } from '../../../store/useJournalStore'
import { Icon } from '../../../icons/Icon'
import { AppLogo } from '../../atoms/AppLogo'
import { SectionLabel } from '../../atoms/SectionLabel'
import type { IconToken } from '../../../icons/tokens'
import type { ThemeMode } from '../../../types'

// ─── Nav items ────────────────────────────────────────────────────────────────

const TOP_NAV: Array<{ to: string; iconName: IconToken; label: string }> = [
  { to: '/notes',   iconName: 'book-open',        label: 'Notes'   },
  { to: '/pennote', iconName: 'pen-line',         label: 'Pen notes' },
  { to: '/journal', iconName: 'calendar-days',    label: 'Journal' },
  { to: '/kanban',  iconName: 'square-kanban',    label: 'Kanban'  },
  { to: '/canvas',  iconName: 'pen-tool',          label: 'Canvas'  },
  { to: '/attachments', iconName: 'paperclip',    label: 'Attachments' },
  { to: '/graph',   iconName: 'network',          label: 'Graph'   },
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

  // Focus/blur as well as hover, so the label is reachable from the keyboard.
  // The control itself still needs its own aria-label — this popover is visual.
  return (
    <div className="relative" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
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
    <Tooltip label={`Theme: ${current.label} · ${current.isDark ? 'Dark' : 'Light'}`}>
      <div ref={ref} className="relative">
        <button
          type="button"
          aria-label="Theme"
          aria-expanded={open}
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
          <div className="absolute bottom-0 left-full z-50 ml-2 w-[21rem] rounded-lg border border-border bg-surface p-1.5 shadow-xl">
            <SectionLabel className="px-2 pb-0.5 pt-1">Theme</SectionLabel>
            <ThemeOptionList value={value} onSelect={t => { onChange(t); setOpen(false) }} />
          </div>
        )}
      </div>
    </Tooltip>
  )
}

// ─── Activity bar ─────────────────────────────────────────────────────────────

const SIDEBAR_TYPES = new Set(['notes', 'pennote', 'journal', 'canvas', 'graph', 'settings', 'attachments'])

function NavBtn({ to, iconName, label, NavIconComponent, activePath, onNav }: {
  to: string
  label: string
  iconName?: IconToken
  NavIconComponent?: React.ElementType
  activePath: string
  onNav: (dest: string, label: string, e: React.MouseEvent) => void
}) {
  const dest = to === '/journal' ? `/journal/${todayDate()}` : to
  const isActive = activePath === to || activePath.startsWith(to + '/')
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        onClick={(e) => onNav(dest, label, e)}
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

export function ActivityBar() {
  const theme         = useAppStore(s => s.theme)
  const setTheme      = useAppStore(s => s.setTheme)
  const sidebarOpen   = useAppStore(s => s.sidebarOpen)
  const setSidebarOpen = useAppStore(s => s.setSidebarOpen)
  const { pages: pluginPages } = usePluginRegistry()

  const activePath = usePaneStore(s => {
    const pane = s.panes.find(p => p.id === s.focusedPaneId)
    return pane?.tabs.find(t => t.id === pane.activeTabId)?.path ?? '/'
  })

  const activeType = pathToType(activePath)
  const focusedHasSidebar = SIDEBAR_TYPES.has(activeType)

  const go = useCallback((to: string, label: string, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      const { focusedPaneId, openInNewTab } = usePaneStore.getState()
      openInNewTab(focusedPaneId, to, label)
    } else {
      const { focusedPaneId, navigatePane } = usePaneStore.getState()
      navigatePane(focusedPaneId, to)
    }
  }, [])

  return (
    <aside
      aria-label="Activity bar"
      className="hidden md:flex w-12 shrink-0 flex-col items-center border-r border-border bg-surface2"
    >
      {/* Logo */}
      <Tooltip label="Kairos — Home">
        <button
          type="button"
          aria-label="Kairos — Home"
          onClick={() => {
            const { focusedPaneId, navigatePane } = usePaneStore.getState()
            navigatePane(focusedPaneId, '/')
          }}
          className="flex h-12 w-12 items-center justify-center text-text2 transition hover:text-text"
        >
          <AppLogo size={28} />
        </button>
      </Tooltip>

      <div className="h-px w-6 shrink-0 bg-border/60" />

      {/* Primary nav */}
      <nav className="flex flex-1 flex-col items-center py-1">
        {TOP_NAV.map(item => <NavBtn key={item.to} {...item} activePath={activePath} onNav={go} />)}

        {pluginPages.map(({ path, navLabel, navIcon: NavIconComponent, navIconName }) => (
          <NavBtn
            key={path}
            to={path}
            label={navLabel}
            NavIconComponent={NavIconComponent ?? undefined}
            iconName={NavIconComponent ? undefined : (navIconName ?? 'puzzle')}
            activePath={activePath}
            onNav={go}
          />
        ))}
      </nav>

      {/* Bottom: plugins → sync → theme → settings → sidebar toggle */}
      <div className="flex flex-col items-center pb-1">
        <SlotRenderer slot="activity-bar:bottom" props={{}} />
        <NavBtn to="/trash" iconName="trash-2" label="Trash" activePath={activePath} onNav={go} />
        <SyncStatusBadge />
        <CompactThemePicker value={theme} onChange={setTheme} />
        <NavBtn to="/settings" iconName="settings-2" label="Settings" activePath={activePath} onNav={go} />
        {/* Sidebar toggle — always occupies its slot; dimmed when page has no sidebar */}
        <Tooltip label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}>
          <button
            type="button"
            aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            onClick={() => focusedHasSidebar && setSidebarOpen(!sidebarOpen)}
            className={`relative flex h-9 w-12 items-center justify-center transition-colors ${
              !focusedHasSidebar ? 'pointer-events-none text-text3/30'
              : sidebarOpen     ? 'text-accent'
              : 'text-text3 hover:text-text'
            }`}
          >
            <Icon name={sidebarOpen ? 'panel-left-close' : 'panel-left-open'} size={18} strokeWidth={1.75} />
          </button>
        </Tooltip>
      </div>
    </aside>
  )
}
