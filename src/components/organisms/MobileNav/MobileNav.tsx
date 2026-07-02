import { useEffect, useState } from 'react'
import { usePaneStore } from '../../../store/usePaneStore'
import { usePluginRegistry } from '../../../plugins/pluginContext'
import { useAppStore } from '../../../store/useAppStore'
import { todayDate } from '../../../store/useJournalStore'
import { THEME_REGISTRY } from '../../../themes/registry'
import { Icon } from '../../../icons/Icon'
import { SectionLabel } from '../../atoms/SectionLabel'
import { registerBackHandler } from '../../../utils/backHandler'
import { useFabSuppressed } from '../../../hooks/useFabSuppressed'
import type { IconToken } from '../../../icons/tokens'

type NavEntry = { to: string; iconName: IconToken; label: string }

const NAV: NavEntry[] = [
  { to: '/',        iconName: 'home',          label: 'Home'    },
  { to: '/notes',   iconName: 'book-open',     label: 'Notes'   },
  { to: '/pennote', iconName: 'pen-line',      label: 'Pen'     },
  { to: '/journal', iconName: 'calendar-days', label: 'Journal' },
  { to: '/kanban',  iconName: 'square-kanban', label: 'Kanban'  },
  { to: '/canvas',  iconName: 'pen-tool',      label: 'Canvas'  },
  { to: '/attachments', iconName: 'paperclip', label: 'Attachments' },
  { to: '/graph',   iconName: 'network',       label: 'Graph'   },
]

const SETTINGS: NavEntry = { to: '/settings', iconName: 'settings-2', label: 'Settings' }

function isActivePath(activePath: string, to: string) {
  if (to === '/') return activePath === '/'
  return activePath === to || activePath.startsWith(to + '/')
}

function NavTile({ entry, active, onSelect }: {
  entry: NavEntry
  active: boolean
  onSelect: (to: string) => void
}) {
  const dest = entry.to === '/journal' ? `/journal/${todayDate()}` : entry.to
  return (
    <button
      type="button"
      onClick={() => onSelect(dest)}
      className={`flex flex-col items-center justify-center gap-1.5 rounded-xl py-3 text-[11px] font-medium transition-colors ${
        active ? 'bg-accent/12 text-accent' : 'text-text2 hover:bg-surface3 active:bg-surface3'
      }`}
    >
      <Icon name={entry.iconName} size={22} strokeWidth={active ? 2 : 1.75} />
      {entry.label}
    </button>
  )
}

export function MobileNav() {
  const { pages: pluginPages } = usePluginRegistry()
  const theme    = useAppStore(s => s.theme)
  const setTheme = useAppStore(s => s.setTheme)
  const [open, setOpen]       = useState(false)
  const [visible, setVisible] = useState(false)
  const fabSuppressed         = useFabSuppressed()

  const activePath = usePaneStore(s => {
    const pane = s.panes.find(p => p.id === s.focusedPaneId)
    return pane?.tabs.find(t => t.id === pane.activeTabId)?.path ?? '/'
  })

  function close() {
    setVisible(false)
    setTimeout(() => setOpen(false), 180)
  }

  // Mount → next frame reveal; close after the exit transition.
  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [open])

  // Escape and the Android back button both dismiss the open panel.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    const unregister = registerBackHandler(close)
    return () => {
      window.removeEventListener('keydown', onKey)
      unregister()
    }
  }, [open])

  function go(to: string) {
    const { focusedPaneId, navigatePane } = usePaneStore.getState()
    navigatePane(focusedPaneId, to)
    close()
  }

  const navEntries: NavEntry[] = [
    ...NAV,
    ...pluginPages.map(p => ({
      to: p.path,
      iconName: (p.navIconName ?? 'puzzle') as IconToken,
      label: p.navLabel,
    })),
    SETTINGS,
  ]

  return (
    <div className="md:hidden">
      {/* Backdrop + panel */}
      {open && (
        <div
          className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
            visible ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={close}
        >
          <div
            onClick={e => e.stopPropagation()}
            className={`absolute right-4 w-[min(20rem,calc(100vw-2rem))] origin-bottom-right overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl transition-all duration-200 ${
              visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
            }`}
            style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}
          >
            <nav className="grid grid-cols-3 gap-1 p-2.5">
              {navEntries.map(entry => (
                <NavTile
                  key={entry.to}
                  entry={entry}
                  active={isActivePath(activePath, entry.to)}
                  onSelect={go}
                />
              ))}
            </nav>

            <div className="border-t border-border px-3 pb-3 pt-2">
              <SectionLabel className="pb-2">Theme</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {THEME_REGISTRY.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    aria-label={`Theme: ${t.label}`}
                    onClick={() => setTheme(t.id)}
                    className={`relative h-7 w-7 rounded-full border transition ${
                      t.id === theme ? 'border-accent ring-2 ring-accent/40' : 'border-border'
                    }`}
                    style={{ background: t.swatchBg }}
                  >
                    <span
                      className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border border-white/25"
                      style={{ background: t.swatchAccent }}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating action button */}
      <button
        type="button"
        aria-label={open ? 'Close navigation' : 'Open navigation'}
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        className={`fixed right-4 z-50 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-fg shadow-lg shadow-black/25 transition-[transform,opacity] active:scale-95 ${
          fabSuppressed && !open ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
        style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        <Icon
          name={open ? 'x' : 'layout-dashboard'}
          size={24}
          strokeWidth={1.75}
          className={`transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
        />
      </button>
    </div>
  )
}
