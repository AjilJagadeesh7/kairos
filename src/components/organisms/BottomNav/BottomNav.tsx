import { usePaneStore, pathToType } from '../../../store/usePaneStore'
import { usePluginRegistry } from '../../../plugins/pluginContext'
import { todayDate } from '../../../store/useJournalStore'
import { Icon } from '../../../icons/Icon'
import type { IconToken } from '../../../icons/tokens'

const TABS: Array<{ to: string; iconName: IconToken; label: string }> = [
  { to: '/notes',   iconName: 'book-open',     label: 'Notes'   },
  { to: '/journal', iconName: 'calendar-days', label: 'Journal' },
  { to: '/kanban',  iconName: 'square-kanban', label: 'Kanban'  },
  { to: '/canvas',  iconName: 'pen-tool',      label: 'Canvas'  },
  { to: '/graph',   iconName: 'network',       label: 'Graph'   },
]

export function BottomNav() {
  const { pages: pluginPages } = usePluginRegistry()

  const activePath = usePaneStore(s => {
    const pane = s.panes.find(p => p.id === s.focusedPaneId)
    return pane?.tabs.find(t => t.id === pane.activeTabId)?.path ?? '/'
  })

  function go(to: string) {
    const { focusedPaneId, navigatePane } = usePaneStore.getState()
    navigatePane(focusedPaneId, to)
  }

  const allTabs = [
    ...TABS,
    ...pluginPages.map(p => ({ to: p.path, iconName: 'bar-chart-2' as IconToken, label: p.navLabel })),
  ]

  return (
    <nav
      aria-label="Main navigation"
      className="md:hidden shrink-0 flex border-t border-border bg-surface2"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {allTabs.map(({ to, iconName, label }) => {
        const dest = to === '/journal' ? `/journal/${todayDate()}` : to
        const isActive = activePath === to || activePath.startsWith(to + '/')
        return (
          <button
            key={to}
            type="button"
            onClick={() => go(dest)}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
              isActive ? 'text-accent' : 'text-text3'
            }`}
          >
            <Icon
              name={iconName}
              size={22}
              strokeWidth={isActive ? 2 : 1.75}
            />
            {label}
          </button>
        )
      })}
    </nav>
  )
}
