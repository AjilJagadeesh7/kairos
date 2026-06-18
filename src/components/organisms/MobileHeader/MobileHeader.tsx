import { useAppStore } from '../../../store/useAppStore'
import { usePaneStore, pathToType } from '../../../store/usePaneStore'
import { SyncStatusBadge } from '../../molecules/SyncStatusBadge'
import { Icon } from '../../../icons/Icon'

const PAGE_LABELS: Record<string, string> = {
  notes:    'Notes',
  pennote:  'Pen notes',
  journal:  'Journal',
  kanban:   'Kanban',
  canvas:   'Canvas',
  graph:    'Graph',
  settings: 'Settings',
  home:     'Kairos',
}

const SIDEBAR_PAGES = new Set(['notes', 'pennote', 'journal', 'canvas', 'graph', 'settings'])

export function MobileHeader() {
  const sidebarOpen    = useAppStore(s => s.sidebarOpen)
  const setSidebarOpen = useAppStore(s => s.setSidebarOpen)

  const activePath = usePaneStore(s => {
    const pane = s.panes.find(p => p.id === s.focusedPaneId)
    return pane?.tabs.find(t => t.id === pane.activeTabId)?.path ?? '/'
  })

  const pageType   = pathToType(activePath)
  const label      = PAGE_LABELS[pageType] ?? 'Kairos'
  const hasSidebar = SIDEBAR_PAGES.has(pageType)
  const isDeepPage = (pageType === 'notes' && activePath !== '/notes') ||
                     (pageType === 'pennote' && activePath !== '/pennote')

  function goBack() {
    const { focusedPaneId, navigatePane } = usePaneStore.getState()
    // Navigate to the section root (e.g. /notes)
    const root = '/' + pageType
    navigatePane(focusedPaneId, root)
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

      {/* Center: page title — static label. Home is reachable via the floating
          nav; making this a button caused accidental navigation on mis-taps. */}
      <span className="flex-1 truncate px-2 text-center text-sm font-semibold text-text">
        {label}
      </span>

      {/* Right: sync status (theme + settings now live in the floating nav) */}
      <div className="flex shrink-0 items-center">
        <SyncStatusBadge />
        <span className="w-9" />
      </div>
    </header>
  )
}
